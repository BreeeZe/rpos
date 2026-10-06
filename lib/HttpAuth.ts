///<reference path="../rpos.d.ts"/>

/*
HTTP authentication helper for RPOS.

Implements HTTP Digest authentication (RFC 7616) with both the MD5 and the
SHA-256 algorithms, qop=auth, a server nonce with an expiry, a nonce-count
replay check and stale=true handling. HTTP Basic (RFC 7617) is supported only
when it is explicitly enabled in the configuration, because Basic sends the
password on the wire in a reversible encoding and RPOS serves plain HTTP.

The credentials are the same ones used for the ONVIF WS-Security
UsernameToken: config.Username and config.Password. When config.Username is
empty, authentication is disabled and every request is allowed, which keeps
the behaviour of an installation that was deliberately left open.

The helper is deliberately transport-level and stateless towards its callers
so it can be used for any endpoint served by the shared http.Server: the
snapshot URI, and (as the ONVIF specification allows HTTP Digest as an
alternative to WS-Security) the ONVIF SOAP endpoints as well.
*/

import crypto = require('crypto');
import { IncomingMessage, ServerResponse } from 'http';
import { Utils } from './utils';

var utils = Utils.utils;

// Nonce bookkeeping. The highest nonce-count seen for a nonce is remembered so
// a replayed request (same nc) is rejected.
interface NonceEntry {
  created: number;
  maxNc: number;
}

interface NonceTable {
  [nonce: string]: NonceEntry;
}

interface AuthParams {
  [name: string]: string;
}

interface AuthResult {
  authenticated: boolean;
  stale: boolean;
}

var DEFAULT_REALM = 'RPOS';
var DEFAULT_NONCE_LIFETIME = 300; // seconds

// Upper bound on remembered nonces. Every challenge issues a nonce, and a
// challenge is sent to clients that have not authenticated, so pruning by age
// alone would let an unauthenticated caller grow this table for as long as a
// nonce lives. When the bound is reached the oldest entries are dropped; a
// client holding one of those is answered with stale=true and retries.
var MAX_NONCES = 512;

// Most preferred algorithm first, as recommended by RFC 7616 section 3.3.
var DIGEST_ALGORITHMS = ['SHA-256', 'MD5'];

class HttpAuth {
  private config: rposConfig;
  private realm: string;
  private nonceLifetime: number; // seconds
  private basicEnabled: boolean;
  private nonces: NonceTable;
  private opaque: string;

  constructor(config: rposConfig) {
    this.config = config;
    this.realm = config.HttpAuthRealm || DEFAULT_REALM;
    this.nonceLifetime = typeof config.HttpDigestNonceLifetime === 'number' && config.HttpDigestNonceLifetime > 0
      ? config.HttpDigestNonceLifetime
      : DEFAULT_NONCE_LIFETIME;
    this.basicEnabled = config.HttpBasicAuthEnabled === true;
    this.nonces = {};
    this.opaque = crypto.randomBytes(16).toString('hex');
  }

  // Authentication is only enforced when the operator configured a username.
  get enabled(): boolean {
    return !!(this.config.Username);
  }

  // Convenience wrapper for a plain http request handler. Returns true when the
  // caller may continue serving the request. When it returns false a 401
  // response has already been written and the caller must not write anything.
  authorizeRequest(request: IncomingMessage, response: ServerResponse): boolean {
    if (!this.enabled)
      return true;

    var result = this.checkAuthorization(request.method, request.url, <string>request.headers['authorization']);
    if (result.authenticated)
      return true;

    this.sendChallenge(response, result.stale);
    return false;
  }

  // Validate an Authorization header. Never throws.
  checkAuthorization(method: string, uri: string, header: string): AuthResult {
    if (!this.enabled)
      return { authenticated: true, stale: false };

    if (!header)
      return { authenticated: false, stale: false };

    var separator = header.indexOf(' ');
    if (separator < 0)
      return { authenticated: false, stale: false };

    var scheme = header.substring(0, separator).toLowerCase();
    var credentials = header.substring(separator + 1).trim();

    if (scheme === 'digest')
      return this.checkDigest(method, uri, credentials);

    if (scheme === 'basic')
      return { authenticated: this.checkBasic(credentials), stale: false };

    return { authenticated: false, stale: false };
  }

  // Write a 401 response carrying one challenge per supported algorithm.
  sendChallenge(response: ServerResponse, stale?: boolean) {
    var body = 'Unauthorized';
    response.writeHead(401, {
      'WWW-Authenticate': this.challengeHeaders(stale),
      'Content-Type': 'text/plain',
      'Content-Length': Buffer.byteLength(body)
    });
    response.end(body);
  }

  // The WWW-Authenticate header values, usable by any caller that builds its
  // own response (for example a SOAP Fault that also advertises HTTP Digest).
  challengeHeaders(stale?: boolean): string[] {
    var nonce = this.createNonce();
    var headers: string[] = [];

    for (var i = 0; i < DIGEST_ALGORITHMS.length; i++) {
      var parts = [
        'realm="' + this.escapeQuoted(this.realm) + '"',
        'qop="auth"',
        'algorithm=' + DIGEST_ALGORITHMS[i],
        'nonce="' + nonce + '"',
        'opaque="' + this.opaque + '"',
        'charset=UTF-8'
      ];
      if (stale)
        parts.push('stale=true');
      headers.push('Digest ' + parts.join(', '));
    }

    if (this.basicEnabled)
      headers.push('Basic realm="' + this.escapeQuoted(this.realm) + '", charset=UTF-8');

    return headers;
  }

  private checkBasic(credentials: string): boolean {
    if (!this.basicEnabled) {
      utils.log.info('HTTP Basic authentication offered by the client but disabled by configuration');
      return false;
    }

    var decoded: string;
    try {
      decoded = Buffer.from(credentials, 'base64').toString('utf8');
    } catch (err) {
      return false;
    }

    var split = decoded.indexOf(':');
    if (split < 0)
      return false;

    var user = decoded.substring(0, split);
    var password = decoded.substring(split + 1);

    var userOk = this.constantTimeEquals(user, this.config.Username);
    var passwordOk = this.constantTimeEquals(password, this.config.Password || '');
    return userOk && passwordOk;
  }

  private checkDigest(method: string, uri: string, credentials: string): AuthResult {
    var params = this.parseAuthParams(credentials);

    var algorithm = (params['algorithm'] || 'MD5').toUpperCase();
    var sessionVariant = false;
    if (algorithm.substring(algorithm.length - 5) === '-SESS') {
      sessionVariant = true;
      algorithm = algorithm.substring(0, algorithm.length - 5);
    }

    var hashName = this.hashNameFor(algorithm);
    if (!hashName)
      return { authenticated: false, stale: false };

    var username = params['username'] || '';
    var nonce = params['nonce'] || '';
    var nc = params['nc'] || '';
    var cnonce = params['cnonce'] || '';
    var qop = params['qop'] || '';
    var digestUri = params['uri'] || '';
    var clientResponse = params['response'] || '';

    if (!nonce || !clientResponse || !digestUri)
      return { authenticated: false, stale: false };

    // Only qop=auth is supported. qop=auth-int would require the body, which is
    // not available at this point.
    if (qop !== 'auth')
      return { authenticated: false, stale: false };

    if (!nc || !cnonce)
      return { authenticated: false, stale: false };

    // The digest-uri is part of HA2, so a client that signed a different
    // resource must not be accepted for this one.
    if (digestUri !== uri)
      return { authenticated: false, stale: false };

    if (params['realm'] !== undefined && params['realm'] !== this.realm)
      return { authenticated: false, stale: false };

    var expectedUser = this.config.Username;
    if (params['userhash'] === 'true') {
      var hashedUser = this.hash(hashName, expectedUser + ':' + this.realm);
      if (!this.constantTimeEquals(username, hashedUser))
        return { authenticated: false, stale: false };
    } else if (!this.constantTimeEquals(username, expectedUser)) {
      return { authenticated: false, stale: false };
    }

    var ncValue = parseInt(nc, 16);
    if (!isFinite(ncValue) || ncValue <= 0)
      return { authenticated: false, stale: false };

    var ha1 = this.hash(hashName, expectedUser + ':' + this.realm + ':' + (this.config.Password || ''));
    if (sessionVariant)
      ha1 = this.hash(hashName, ha1 + ':' + nonce + ':' + cnonce);

    var ha2 = this.hash(hashName, (method || 'GET') + ':' + digestUri);

    var expected = this.hash(hashName, [ha1, nonce, nc, cnonce, qop, ha2].join(':'));

    if (!this.constantTimeEquals(clientResponse.toLowerCase(), expected))
      return { authenticated: false, stale: false };

    // The credentials are correct. Now judge the nonce. A nonce we never issued,
    // or one that has expired, means the client should retry with a fresh
    // challenge rather than be prompted for the password again.
    this.pruneNonces();
    var entry = this.nonces[nonce];
    if (!entry)
      return { authenticated: false, stale: true };

    var ageSeconds = (Date.now() - entry.created) / 1000;
    if (ageSeconds > this.nonceLifetime)
      return { authenticated: false, stale: true };

    // Replay check: the nonce-count must strictly increase for a given nonce.
    if (ncValue <= entry.maxNc) {
      utils.log.info('Rejected a replayed HTTP Digest nonce-count');
      return { authenticated: false, stale: true };
    }
    entry.maxNc = ncValue;

    return { authenticated: true, stale: false };
  }

  private hashNameFor(algorithm: string): string {
    if (algorithm === 'MD5')
      return 'md5';
    if (algorithm === 'SHA-256')
      return 'sha256';
    return null;
  }

  private hash(hashName: string, data: string): string {
    return crypto.createHash(hashName).update(data, 'utf8').digest('hex');
  }

  private createNonce(): string {
    this.pruneNonces();
    this.enforceNonceLimit();
    var nonce = crypto.randomBytes(24).toString('hex');
    this.nonces[nonce] = { created: Date.now(), maxNc: 0 };
    return nonce;
  }

  // Drop the oldest nonces until there is room for one more.
  private enforceNonceLimit() {
    var keys = Object.keys(this.nonces);
    if (keys.length < MAX_NONCES)
      return;

    var self = this;
    keys.sort(function (a, b) { return self.nonces[a].created - self.nonces[b].created; });
    for (var i = 0; i <= keys.length - MAX_NONCES; i++)
      delete this.nonces[keys[i]];
  }

  // Expired nonces are kept for one extra lifetime so a request that arrives
  // just after the expiry can still be answered with stale=true instead of a
  // bare authentication failure. After that they are forgotten.
  private pruneNonces() {
    var cutoff = Date.now() - (this.nonceLifetime * 2 * 1000);
    var keys = Object.keys(this.nonces);
    for (var i = 0; i < keys.length; i++) {
      if (this.nonces[keys[i]].created < cutoff)
        delete this.nonces[keys[i]];
    }
  }

  // Comparison whose duration does not depend on where the first difference is.
  private constantTimeEquals(a: string, b: string): boolean {
    var bufferA = Buffer.from(String(a === undefined || a === null ? '' : a), 'utf8');
    var bufferB = Buffer.from(String(b === undefined || b === null ? '' : b), 'utf8');
    // timingSafeEqual requires equal lengths, so compare fixed-size digests of
    // the inputs. The length of the secret is then not leaked either.
    var keyedA = crypto.createHash('sha256').update(bufferA).digest();
    var keyedB = crypto.createHash('sha256').update(bufferB).digest();
    return crypto.timingSafeEqual(keyedA, keyedB);
  }

  private escapeQuoted(value: string): string {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  // Parse a comma separated list of name=value or name="value" pairs, honouring
  // quoted strings and backslash escapes inside them.
  private parseAuthParams(credentials: string): AuthParams {
    var params: AuthParams = {};
    var index = 0;
    var length = credentials.length;

    while (index < length) {
      while (index < length && (credentials.charAt(index) === ' ' || credentials.charAt(index) === ',' || credentials.charAt(index) === '\t'))
        index++;

      var nameStart = index;
      while (index < length && credentials.charAt(index) !== '=' && credentials.charAt(index) !== ',')
        index++;

      var name = credentials.substring(nameStart, index).trim().toLowerCase();
      if (!name)
        break;

      if (index >= length || credentials.charAt(index) !== '=') {
        params[name] = '';
        continue;
      }

      index++; // skip '='
      var value = '';

      if (index < length && credentials.charAt(index) === '"') {
        index++; // skip opening quote
        while (index < length) {
          var ch = credentials.charAt(index);
          if (ch === '\\' && index + 1 < length) {
            value += credentials.charAt(index + 1);
            index += 2;
            continue;
          }
          if (ch === '"') {
            index++;
            break;
          }
          value += ch;
          index++;
        }
      } else {
        var valueStart = index;
        while (index < length && credentials.charAt(index) !== ',')
          index++;
        value = credentials.substring(valueStart, index).trim();
      }

      params[name] = value;
    }

    return params;
  }
}

export = HttpAuth;
