/// <reference path="../typings/node/node.d.ts"/>
import { networkInterfaces } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter} from "events";
import { Writable, Readable } from "stream";
import * as crypto from "crypto";

var clc = require('cli-color');

export module Utils {
  export enum logLevel {
    None = 0,
    Error = 1,
    Warn = 2,
    Info = 3,
    Debug = 4
  }

  class DummyProcess extends EventEmitter implements ChildProcess {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    stdio: [Writable, Readable, Readable];
    pid: number;
    constructor() {
      super();
      this.stdin = new Writable();
      this.stderr = this.stdout = new DummyReadable();
    }
    kill(signal?: string) { };
    send(message: any, sendHandle?: any) { };
    disconnect() { };
    unref() { };
  }

  class DummyReadable extends Readable {
    read() { return null; }
  }

  export class utils {
    private static config: rposConfig;
    static setConfig(config: rposConfig) {
      this.config = config;
    }

    static getSerial() {
      // Extract serial from cpuinfo file
      var cpuserial = "0000000000000000";
      try {
        var f = utils.execSync('sudo cat /proc/cpuinfo').toString();
        cpuserial = f.match(/Serial[\t]*: ([0-9a-f]{16})/)[1];
      } catch (ex) {
        this.log.error("Failed to read serial : %s", ex.message);
        cpuserial = "ERROR000000000";
      }
      return cpuserial;
    }

    static testIpAddress() {
      var ip, interfaces = networkInterfaces();
      for (var inf of this.config.NetworkAdapters) {
        ip = this.getAddress(interfaces[inf], "IPv4");
        if (!ip)
          utils.log.debug("Read IP address from %s failed", inf);
        else {
          utils.log.info("Read IP address %s from %s", ip, inf);
          return;
        }
      }
      utils.log.info("Using IP address from config: %s", this.config.IpAddress);
    }
    private static getAddress = (ni: any[], type) => {
      ni = ni || [];
      var address = "";
      for (var nif of ni) {
        if (nif.family == type)
          address = nif.address;
      }
      return address;
    };

    static getIpAddress(type?: string) {
      type = type || "IPv4";
      var interfaces = networkInterfaces();
      for (var inf of this.config.NetworkAdapters) {
        var ip = this.getAddress(interfaces[inf], type);
        if (ip)
          return ip;
      }
      return this.config.IpAddress;
    }

    static notPi() {
      return /^win/.test(process.platform) || /^darwin/.test(process.platform);
    }

    static log = {
      level: logLevel.Error,
      error(message: string, ...args) {
        if (utils.log.level > logLevel.None) {
          message = clc.red(message);
          console.log.apply(this, [message, ...args]);
        }
      },
      warn(message: string, ...args) {
        if (utils.log.level > logLevel.Error) {
          message = clc.yellow(message);
          console.log.apply(this, [message, ...args]);
        }
      },
      info(message: string, ...args) {
        if (utils.log.level > logLevel.Warn)
          console.log.apply(this, [message, ...args]);
      },
      debug(message: string, ...args) {
        if (utils.log.level > logLevel.Info) {
          message = clc.green(message);
          console.log.apply(this, [message, ...args]);
        }
      }
    }
    static execSync(cmd: string) {
      utils.log.debug(["execSync('", cmd, "')"].join(''));
      return utils.notPi() ? "" : require('child_process').execSync(cmd);
    }
    static spawn(cmd: string, args?: string[], options?: {}): ChildProcess {
      utils.log.debug(`spawn('${cmd}', [${args.join()}], ${options})`);
      if (utils.notPi()) {
        return new DummyProcess();
      }
      else {
        return spawn(cmd, args, options);
      }
    }

    static cleanup(callback: () => void) {

      // attach user callback to the process event emitter
      // if no callback, it will still exit gracefully on Ctrl-C
      callback = callback || (() => { });
      process.on('cleanup', callback);

      // do app specific cleaning before exiting
      process.on('exit', () => {
        process.emit('cleanup');
      });

      // catch ctrl+c event and exit normally
      process.on('SIGINT', () => {
        console.log('Ctrl-C...');
        process.exit(2);
      });

      //catch uncaught exceptions, trace, then exit normally
      process.on('uncaughtException', (e) => {
        utils.log.error('Uncaught Exception... : %s', e.stack);
        process.exit(99);
      });
    }

    static uuid5(str: string) {
      var out = crypto.createHash("sha1").update(str).digest();

      out[8] = out[8] & 0x3f | 0xa0; // set variant
      out[6] = out[6] & 0x0f | 0x50; // set version

      let hex = out.toString("hex", 0, 16);

      return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
      ].join("-");
    };
  };
}