export const NOT_AUTHORIZED = {
    Fault: {
        attributes: { // Add namespace here. Really wanted to put it in Envelope but this should be valid
            'xmlns:ter': 'http://www.onvif.org/ver10/error',
        },
        Code: {
            Value: "soap:Sender",
            Subcode: {
                Value: "ter:NotAuthorized",
            },
        },
        Reason: {
            Text: {
                attributes: {
                    'xml:lang': 'en',
                },
                $value: 'Sender not Authorized',
            }
        }
    }
};
