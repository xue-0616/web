import { GenericAddress } from '../../../common/genericAddress';
import { Chain, chainFromStr } from '../../../common/genericChain';
import { BadRequestException } from '../../../error';

export class LoginMessage {
    originMessage: string;
    addr: GenericAddress;
    issuedAt: Date;
    expirationTime: Date;

    constructor(originMessage: string, addr: GenericAddress, issuedAt: Date, expirationTime: Date) {
        this.originMessage = originMessage;
        this.addr = addr;
        this.issuedAt = issuedAt;
        this.expirationTime = expirationTime;
    }
    static fromComponents(addr: any, issuedAt: any, expirationTime: any) {
        let originMessage: string = '';
        switch (addr.chain) {
            case Chain.Evm: {
                originMessage = `Welcome! Please sign to log in DexAuto with your Ethereum account:
${addr.address()}

Website: https://dexauto.ai
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}
`;
                break;
            }
            case Chain.Solana: {
                originMessage = `Welcome! Please sign to log in DexAuto with your Solana account:
${addr.address()}

Website: https://dexauto.ai
Issued At: ${issuedAt.toISOString()}
Expiration Time: ${expirationTime.toISOString()}
`;
                break;
            }
        }
        return new LoginMessage(originMessage, addr, issuedAt, expirationTime);
    }
    static parse(s: any) {
        const pattern = /Welcome! Please sign to log in DexAuto with your (Ethereum|Solana) account:\n((0x[a-fA-F0-9]{40})|([1-9A-HJ-NP-Za-km-z]{32,44}))\n\nWebsite: https:\/\/dexauto\.ai\nIssued At: ([\d-]+T[\d:.]+Z)\nExpiration Time: ([\d-]+T[\d:.]+Z)/;
        const matches = s.match(pattern);
        if (matches && matches.length === 7) {
            const blockchainType = matches[1]!;
            const address = matches[2]!;
            const issuedAt = new Date(matches[5]!);
            const expirationTime = new Date(matches[6]!);
            const chain = chainFromStr(blockchainType);
            const genericAddr = new GenericAddress(chain, address);
            return new LoginMessage(s, genericAddr, issuedAt, expirationTime);
        }
        else {
            throw new BadRequestException('invalid login message');
        }
    }
    validate(sig: any): void {
        const now = new Date();
        if (now > this.expirationTime) {
            throw new BadRequestException('login message expired');
        }
        // Validate issuedAt is not unreasonably old (max 1 hour in the past)
        const maxIssuedAtAge = 60 * 60 * 1000; // 1 hour in ms
        if (now.getTime() - this.issuedAt.getTime() > maxIssuedAtAge) {
            throw new BadRequestException('login message issuedAt is too old');
        }
        // Validate issuedAt is not in the future (with small tolerance for clock skew)
        const clockSkewTolerance = 60 * 1000; // 1 minute
        if (this.issuedAt.getTime() > now.getTime() + clockSkewTolerance) {
            throw new BadRequestException('login message issuedAt is in the future');
        }
        // Validate the window between issuedAt and expirationTime is reasonable (max 1 hour)
        const maxWindow = 60 * 60 * 1000; // 1 hour
        if (this.expirationTime.getTime() - this.issuedAt.getTime() > maxWindow) {
            throw new BadRequestException('login message validity window is too large');
        }
        return this.addr.validate(this.originMessage, sig);
    }
}
