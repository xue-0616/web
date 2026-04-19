import { KeyEmailDkim, Keyset } from '@unipasswallet/keys';
import { BadRequestException } from '@nestjs/common';
import { StatusName } from './status.msg.code';
import { getFuzzyEmail } from './mycrypto';

interface WalletLogger { error(msg: string): void }

export function getKeysetData(keysetJson: string, logger: WalletLogger): { keyset: Keyset } {
    let keyset: Keyset;
    try {
        keyset = Keyset.fromJson(keysetJson);
    }
    catch (error) {
        const e = error as Error;
        logger.error(`[getKeysetData]${e},${e?.stack},data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
    return { keyset };
}
export function hideSecurityInformation(
    keysetData: { keyset: string; [k: string]: unknown },
    logger: WalletLogger,
): typeof keysetData {
    try {
        const keyset = Keyset.fromJson(keysetData.keyset);
        const keys = keyset.keys;
        for (const [index, item] of keys.entries()) {
            if (index < 2) {
                continue;
            }
            const key = item as KeyEmailDkim;
            if (!key.emailFrom) {
                continue;
            }
            const hiddenKey = new KeyEmailDkim('Hash', getFuzzyEmail(key.emailFrom), '0x0000000000000000000000000000000000000000000000000000000000000000', key.roleWeight, key.getDkimParams(), key.emailHash);
            keys[index] = hiddenKey;
        }
        keysetData.keyset = keyset.toJson();
        return keysetData;
    }
    catch (error) {
        const e = error as Error;
        logger.error(`[hideSecurityInformation] ${e},${e?.stack},data = ${JSON.stringify({
            keysetJson: keysetData.keyset,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
