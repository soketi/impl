import crypto from 'crypto';

export class Token {
    constructor(
        protected key: string,
        protected secret: string,
    ) {
        //
    }

    sign(string: string) {
        return crypto
            .createHmac('sha256', this.secret)
            .update(Buffer.from(string))
            .digest('hex');
    }

    verify(string: string, signature: string) {
        return this.secureCompare(
            this.sign(string),
            signature
        );
    }

    secureCompare(a: string, b: string) {
        if (a.length !== b.length) {
            return false;
        }

        let result = 0;

        for (const i in [...a]) {
            result |= a.charCodeAt(i as unknown as number) ^ b.charCodeAt(i as unknown as number);
        }

        return result === 0;
    }
}
