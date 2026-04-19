import { Chain } from '../../../common/genericChain';
import { GenericAddress } from '../../../common/genericAddress';
import { addMinutes } from 'date-fns';
import { BadRequestException } from '../../../error';

const EXPIRATION_INTERVAL_MINS = 10;
export class DeleteWalletMessage {
    originMessage: string;
    addr: GenericAddress;
    deleteTime: Date;
    expirationTime: Date;

    constructor(originMessage: string, addr: GenericAddress, deleteTime: Date, expirationTime?: Date) {
        this.originMessage = originMessage;
        this.addr = addr;
        this.deleteTime = deleteTime;
        this.expirationTime = expirationTime
            ? expirationTime
            : addMinutes(deleteTime, EXPIRATION_INTERVAL_MINS);
    }
    static fromComponents(addr: any, deleteTime: any, expirationTime: any) {
        const originMessage = `Sign to delete this wallet. Make sure your private key is saved, or you will lose all assets in this wallet:
${addr.address}

Website: https://dexauto.ai
Delete Time: ${deleteTime.toISOString()}
`;
        return new DeleteWalletMessage(originMessage, addr, deleteTime, expirationTime);
    }
    static parse(chain: any, s: any) {
        const pattern = /Sign to delete this wallet\. Make sure your private key is saved, or you will lose all assets in this wallet:\n((0x[a-fA-F0-9]{40})|([1-9A-HJ-NP-Za-km-z]{32,44}))\n\nWebsite: https:\/\/dexauto\.ai\nDelete Time: ([\d-]+T[\d:.]+Z)/;
        const matches = s.match(pattern);
        if (matches && matches.length === 5) {
            const address = matches[1];
            const addr = new GenericAddress(chain, address);
            const deleteTime = matches[4];
            return new DeleteWalletMessage(s, addr, new Date(deleteTime));
        }
        else {
            throw new BadRequestException('invalid delete wallet message');
        }
    }
    validate(userBoundAddr: any, sig: any): void {
        const now = new Date();
        if (now > this.expirationTime) {
            throw new BadRequestException('delete wallet message expired');
        }
        return userBoundAddr.validate(this.originMessage, sig);
    }
}
