import { Injectable } from '@nestjs/common';
import { IsIsValidTypedDataSignatureInput, IsValidMessageSignatureInput, Prefix } from './dto/sign.input';
import { IsValidOutput } from './dto/sign.output';
import { AccountInfoService } from 'src/account/db/account.info.service';
import { getLogger } from '../common/logger/logger.helper';
import { utils } from 'ethers';
import { hashMessage, hexlify } from 'ethers/lib/utils';
import { uniPassHashMessage, verifyTypedData } from './utils/sign.api.utils';
import { encodeTypedDataDigest } from '@unipasswallet/popup-utils';
import { Keyset } from '@unipasswallet/keys';
import { Wallet, isValidSignature } from '@unipasswallet/wallet';

@Injectable()
export class ApiService {
    constructor(private readonly accountDbService: AccountInfoService) {
        this.logger = getLogger('api');
    }
    private logger: any;
    async getIsValidMessageSignature(input: IsValidMessageSignatureInput): Promise<IsValidOutput> {
            const { walletAddress, prefix, message, signature } = input;
            const output = { isValid: false };
            if (prefix !== Prefix.UniPassPrefix && prefix !== Prefix.EIP191Prefix) {
                return output;
            }
            if (!utils.isAddress(walletAddress)) {
                return output;
            }
            const isEIP191Prefix = prefix === Prefix.EIP191Prefix;
            const rawMessage = isEIP191Prefix
                ? hashMessage(message)
                : uniPassHashMessage(message);
            const keysetJson = await this.accountDbService.findOneAccountKeysetJsonHashByAddress(walletAddress);
            if (!keysetJson) {
                return output;
            }
            output.isValid = await this.verifyIsValidSignature(keysetJson, walletAddress, rawMessage, signature);
            return output;
        }
    async getIsValidTypedDataSignature(input: IsIsValidTypedDataSignatureInput): Promise<IsValidOutput> {
            const { walletAddress, signature, typeData } = input;
            const output = { isValid: false };
            if (!utils.isAddress(walletAddress)) {
                return output;
            }
            if (!verifyTypedData(typeData)) {
                return output;
            }
            let messageHash = '';
            try {
                messageHash = hexlify(encodeTypedDataDigest(typeData));
            }
            catch (error) {
                const e = error as Error;
                this.logger.warn(`[getIsValidTypedDataSignature] ${e.message}`);
                return output;
            }
            const keysetJson = await this.accountDbService.findOneAccountKeysetJsonHashByAddress(walletAddress);
            if (!keysetJson) {
                return output;
            }
            output.isValid = await this.verifyIsValidSignature(keysetJson, walletAddress, messageHash, signature);
            return output;
        }
    async verifyIsValidSignature(keysetJson: string, address: string, messageHash: string, signature: string): Promise<boolean> {
            let isValid = false;
            const keyset = Keyset.fromJson(keysetJson);
            const wallet = new Wallet({ keyset, address });
            try {
                isValid = await isValidSignature(messageHash, signature, wallet.address, wallet.keyset.hash());
            }
            catch (error) {
                const e = error as Error;
                this.logger.warn(`[isValidSignature] ${e.message}`);
            }
            return isValid;
        }
}
