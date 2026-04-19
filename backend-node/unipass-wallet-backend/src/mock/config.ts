import { Wallet as EthersWallet, JsonRpcProvider } from 'ethers';
import { RpcRelayer } from '@unipasswallet/relayer';
import { getUnipassWalletContext } from '../shared/utils';
import { Wallet } from '@unipasswallet/wallet';
import { Keyset } from '@unipasswallet/keys';

const rpcUrl = ' https://rpc.ankr.com/polygon_mumbai';
const password = '123456';
const provider = new JsonRpcProvider(rpcUrl);
const rpcRelayer = new RpcRelayer('https://d.wallet.unipass.vip/relayer-polygon', getUnipassWalletContext(), provider);
export const accessToken = '';
const openIDOptions = {
    idToken: '',
};
const email = 'aven9241@gmail.com';
export function parsGooleUrl() {
    // NOTE: production callers must inject a real URL via the
    // surrounding config/env; this literal is only kept so the
    // parser has a valid shape to tokenise during unit tests.
    // The former hardcoded value was an expired 2022 Google OAuth
    // Playground example token and has been redacted to satisfy
    // GitHub's secret-scanning push protection.
    const url = 'https://developers.google.com/oauthplayground/#state=af0ifjsldkj&access_token=REDACTED_EXAMPLE_ACCESS_TOKEN&token_type=Bearer&expires_in=3599&scope=email%20profile&id_token=REDACTED_EXAMPLE_ID_TOKEN&authuser=0&prompt=consent';
    exports.accessToken = url.split('access_token=')[1].split('&')[0];
    const idToken = url.split('id_token=')[1].split('&')[0];
    openIDOptions.idToken = idToken;
    return { accessToken: exports.accessToken, openIDOptions };
}
export const guardianEmails = [
    {
        email: 'aven123@qq.com',
        isSelfGuardian: false,
    },
];
export const newguardianEmails = [
    {
        email: 'aven123@qq.com',
        isSelfGuardian: false,
    },
    {
        email: '874317611@qq.com',
        isSelfGuardian: false,
    },
];
const recoveryMasterKeyWallet = new Wallet('d112b04c22f4d2211a3333881222bbbf361999421acf3b011adca22221a2c002');
const masterKeyWallet = Wallet.createRandom();
const poliycAddress = '0xBAAF7Bc749Bba6867F28B30CDec99c0160a6Fc22';
const pepper = '0xd192b04123f4d538f3eacee3dbb7d0bf3619994214cf3b011adca22221a2c1a2';
const sessionKey = new Wallet('d123304c1ef4d538f3aa7ee3daa7d0bf3619294214cfab011ad0abbb12120e12');
const generateAccountAddress = (keysetJson) => {
    try {
        const wallet = Wallet.create({
            keyset: Keyset.fromJson(keysetJson),
            context: getUnipassWalletContext(),
            provider,
        });
        return wallet.address;
    }
    catch (_a) {
        return '';
    }
};
export const config = {
    email,
    password,
    sessionKey,
    masterKeyWallet,
    recoveryMasterKeyWallet,
    poliycAddress,
    pepper,
    guardianEmails: exports.guardianEmails,
    provider,
    rpcRelayer,
    newguardianEmails: exports.newguardianEmails,
    generateAccountAddress,
    accessToken: exports.accessToken,
    openIDOptions,
};
