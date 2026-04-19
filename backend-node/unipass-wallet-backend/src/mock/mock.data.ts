import moment from 'moment';
import { config, parsGooleUrl } from './config';
import { buildSignKeyset, getAccountKMSKeysetJson, getAccountKeysetJson } from './rbac';
import { encryptMasterKey, signBufferMsg, signMsg } from './master-key';
import { SIG_PREFIX } from '../shared/utils';
import { KeyType } from '../interfaces';
import { Wallet, ZeroAddress } from 'ethers';
import { getUpdateKeysetHashTxBuilderMessage } from '../shared/utils/unipass.tx.executor';
import { Keyset } from '@unipasswallet/keys';
import { solidityPacked } from 'ethers';
import { OtpAction } from '../modules/otp/dtos';
import { CancelLockKeysetHashTxBuilder } from '@unipasswallet/transaction-builders';
import { AuthStatus, AuthType } from '../modules/account/entities';
const { email, password, sessionKey, masterKeyWallet, poliycAddress, pepper, newguardianEmails, provider, rpcRelayer, generateAccountAddress, } = config;
const { openIDOptions } = parsGooleUrl();
let keysetJson = getAccountKeysetJson([], email, openIDOptions, masterKeyWallet.address, poliycAddress, pepper);
let address = '0xDD9EAEC568038252A597048E12A75BC3DF65FC2D';
export const signUpData = async () => {
    const timestamp = moment().add(10, 'minute').unix();
    const sig = await signBufferMsg(Buffer.from(SIG_PREFIX.UPLOAD + timestamp, 'utf-8'), masterKeyWallet.privateKey);
    const keyStore = await encryptMasterKey(masterKeyWallet.privateKey, password);
    const masterKey = {
        kdfPassword: password,
        masterKeyAddress: masterKeyWallet.address,
        timestamp,
        sig,
        keyStore,
    };
    keysetJson = getAccountKeysetJson([], email, openIDOptions, masterKey.masterKeyAddress, poliycAddress, pepper);
    address = generateAccountAddress(keysetJson);
    const signUpInput = {
        pepper,
        masterKey,
        keysetJson,
        source: 'test',
    };
    return signUpInput;
};
function initMessage(masterKeyAddress, message) {
    const rawMessage = `UniPass wants you to sign in with your Ethereum account:\n\n${masterKeyAddress}\n\nI accept to sign in to UniPass Wallet with my Ethereum account.\n\nURI: ${message.uri}\n\nVersion: ${message.version}\n\nChain ID: ${message.chainId}\n\nNonce: ${message.nonce}\n\nIssued At: ${message.isssuedAt}\n\nExpiration Time: ${message.expirationTime}`;
    return rawMessage;
}
export const signUpDataWithSnap = async () => {
    const message = {
        uri: 'uri',
        version: 1,
        chainId: 1,
        isssuedAt: '2021-07-12T01:07:01.000Z',
        nonce: '1',
        expirationTime: '2023-07-12T01:07:01.000Z',
    };
    const rawMessage = initMessage(masterKeyWallet.address, message);
    const sig = await signBufferMsg(Buffer.from(rawMessage, 'utf-8'), masterKeyWallet.privateKey);
    const masterKey = {
        masterKeyAddress: masterKeyWallet.address,
        keySig: { message: rawMessage, sig },
        keyType: KeyType.SNAP,
    };
    keysetJson = getAccountKeysetJson([], email, openIDOptions, masterKey.masterKeyAddress, poliycAddress, pepper);
    address = generateAccountAddress(keysetJson);
    const signUpInput = {
        pepper,
        masterKey,
        keysetJson,
        source: 'test',
    };
    return signUpInput;
};
export const signUpDataWithKMS = () => {
    const masterKey = {
        masterKeyAddress: masterKeyWallet.address,
        keyType: KeyType.AWS_KMS,
        keyStore: `${JSON.stringify({ key: '' })}`,
    };
    keysetJson = getAccountKMSKeysetJson(masterKey.masterKeyAddress);
    address = generateAccountAddress(keysetJson);
    const signUpInput = {
        masterKey,
        keysetJson,
        source: 'test',
    };
    return signUpInput;
};
export const getWeb3authInfo = async (sub) => {
    const k1 = Wallet.createRandom();
    const idTokenPayload = `{"open_id":"${sub}"}`;
    const sig = await k1.signMessage(idTokenPayload);
    let web3auth = {
        address: k1.address,
        sig,
        message: idTokenPayload,
    };
    return web3auth;
};
export const checkKeysetInput = () => {
    keysetJson = getAccountKeysetJson(newguardianEmails, email, openIDOptions, masterKeyWallet.address, poliycAddress, pepper);
    return {
        keysetJson,
        isAddGuradian: true,
    };
};
export const updateGuardianData = async () => {
    const metaNonce = 1;
    keysetJson = getAccountKeysetJson(newguardianEmails, email, openIDOptions, masterKeyWallet.address, poliycAddress, pepper);
    const digestHash = getUpdateKeysetHashTxBuilderMessage(address, metaNonce, Keyset.fromJson(keysetJson).hash());
    const sig = await signMsg(digestHash, masterKeyWallet.privateKey);
    const masterKeySig = solidityPacked(['bytes', 'uint8'], [sig, 2]);
    return {
        masterKeySig,
    };
};
export const getEmail = () => email;
export const getLoginInput = () => {
    const authenticators = {
        email,
        action: OtpAction.Login,
        code: '123456',
    };
    const loginInput = {
        email,
        upAuthToken: '',
        authenticators,
    };
    return loginInput;
};
export const getPasswordTokenInput = () => {
    const passwordInput = {
        email,
        kdfPassword: password,
    };
    return passwordInput;
};
export const getUploadRecoveryMasterKeyInput = async () => {
    const masterKeyRandomWallet = new Wallet('d192c04c2ef4d538f3ea7ee3dcc7d0bf3619994214cf3b011ad0a22cccc23aab');
    const newPassword = 'abababa';
    const keyStore = await encryptMasterKey(masterKeyRandomWallet.privateKey, newPassword);
    const masterKey = {
        masterKeyAddress: masterKeyRandomWallet.address,
        keyStore,
    };
    return {
        masterKey,
    };
};
export const getSendRecoveryEmailInput = () => ({
    newMasterKeyAddress: '',
    verificationEmailHash: '0xa76a4a59d549dd922fe056118884b5ba2a9f5240fe88d74daf4d0d24525f8994',
});
export const getEmailCheckInput = async (emailAddress) => {
    const timestamp = moment().unix();
    const signatureMessage = `UniPass:Email.Check:${timestamp}:${emailAddress}`;
    const k1 = Wallet.createRandom();
    const signature = await k1.signMessage(signatureMessage);
    return { email, signature, timestamp, address: k1.address };
};
export const getStartRecovery = () => ({
    verificationEmailHashs: [
        '0xa76a4a59d549dd922fe056118884b5ba2a9f5240fe88d74daf4d0d24525f8994',
    ],
});
export const getCancelRecoveryInput = async (metaNonce) => {
    var _a;
    const txBuilder = new CancelLockKeysetHashTxBuilder(address, metaNonce, false);
    const masterKeyRandomWallet = new Wallet('d192c04c2ef4d538f3ea7ee3dcc7d0bf3619994214cf3b011ad0a22bbbb23aab');
    const digestHash = txBuilder.digestMessage();
    const sig = await signMsg(digestHash, masterKeyRandomWallet.privateKey);
    const masterKeySig = solidityPacked(['bytes', 'uint8'], [sig, 2]);
    keysetJson = getAccountKeysetJson([], email, openIDOptions, sessionKey.address, poliycAddress, pepper);
    const keyset = buildSignKeyset(keysetJson, masterKeySig);
    const keyWallet: any = new (Wallet as any)({
        address,
        keyset,
        provider,
        relayer: rpcRelayer,
    });
    const nonce = await ((_a = keyWallet.relayer) === null || _a === void 0 ? void 0 : _a.getNonce(keyWallet.address));
    let tx = (await txBuilder.generateSignature(keyWallet, [0])).build();
    const transactionData = await keyWallet.toTransaction({
        type: 'Execute',
        transactions: [tx],
        sessionKeyOrSignerIndex: [],
        gasLimit: 0n,
    }, nonce);
    tx = transactionData[0];
    const cancelRecovery = {
        metaNonce,
        signature: txBuilder.signature,
        transaction: {
            callType: tx.callType,
            revertOnError: false,
            gasLimit: tx.gasLimit,
            target: tx.target,
            value: tx.value,
            data: tx.data,
        },
    };
    return cancelRecovery;
};
export const addAuthenticatorData = () => {
    const data = {
        type: 2,
        value: '',
        code: '',
        idToken: '',
    };
    return data;
};
export const setAuthenticatorStatusInput = () => {
    const data = {
        type: AuthType.GoogleAuthenticator,
        status: AuthStatus.Close,
    };
    return data;
};
export const getDelAuthenticatorInput = () => {
    const data = {
        type: AuthType.WebAuthn,
        idToken: '',
    };
    return data;
};
export const getSend2FaOtpCodeInput = () => {
    const data = {
        action: OtpAction.BindPhone,
        bindPhone: {
            phone: '18380484212',
            areaCode: '+86',
        },
        authType: AuthType.Phone,
    };
    return data;
};
export const getVerifyOtp2FaCodeInput = () => {
    const data = {
        action: OtpAction.BindPhone,
        bindPhone: {
            phone: '18380484212',
            areaCode: '+86',
        },
        authType: AuthType.Phone,
        code: '123456',
    };
    return data;
};
export const updateAccountPassword = () => {
    const data = {
        email,
        kdfPassword: '12345',
        auth2FaToken: [
            {
                type: 0,
                upAuthToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY3Rpb24iOiJwYXNzd29yZExvZ2luIiwia2V5IjoiYXZlbjkyNDFAZ21haWwuY29tX2RlZmF1bHRrZXkifQ.LQKXMjTUPe9DC7EY5_RH4-zVBn3jun7FESfyDcGMAP2',
            },
        ],
    };
    return data;
};
export const getSendEmailBody = {
    'Accept-Language': 'zh-CN, en-US',
    'Arc-Authentication-Results': 'i=1; mx.microsoft.com 1; spf=none; dmarc=none; dkim=none; arc=none',
    'Arc-Message-Signature': 'i=1; a=rsa-sha256; c=relaxed/relaxed; d=microsoft.com; s=arcselector9901; h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-AntiSpam-MessageData-ChunkCount:X-MS-Exchange-AntiSpam-MessageData-0:X-MS-Exchange-AntiSpam-MessageData-1; bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=; b=S3kss/8NphyG4viETWasvUzbGkc3WuJBeAinQC3TERtweYc7M+TpzI82qvjKZxEnbzNRRUG9nMO/w0Z2RzbanVMomWTNPGy3O7R5Mc8fWKH5Ib2HvSyInki03TVlRxpi1YSo51vOrENzORb9Ld0ReWo0pIAL+Ebpokd+r4SAG+MVccOlcqca21zHiSWXLiPcaaejYtc+ghzjQYMFrmVEflz2KKWIq5WU2pL4KAcmEO1/PB9Q7a7CkXkh1YPjO+IPiLNGfsovjs+bYNP3S9eYCBWV4x/IMa4nu9p/i3xbiTOOPZbFYK2mJHHLJzrhv9qIqYz8/SZOgfuUBoqcQSsBew==',
    'Arc-Seal': 'i=1; a=rsa-sha256; s=arcselector9901; d=microsoft.com; cv=none; b=c5IJDi474sqLt6nswL4qXmuMnq9MmIO3nvGwp6wpekQ6B81Dc4/KvDM1KzvPICbeNtKmspBQnEebYABUYYejcCFk72pHRjT0X9eDMC6WlmJWxBfTap+j0Kn8pV8gQellObMkCD09mPftk2uRmZahE/LIKORR0Gut96vyPFocFvjx9WS5UEFfb3ui4XX99UiEZYiXvE9InGCQhzsQ8AxSJROzfzSHBYF69uJNIsUl9Jkl6RzA28NNy0A4RePhvUrKIp6gGDzkJc2FEsO7O8gPPuSAJ1UI1qxtfLtwrxHNhEQZ7fbUHceiwn4B1YxliyHghviUZ+ZC+gJj6GlMPalAXg==',
    'Content-Language': 'zh-CN',
    'Content-Type': 'multipart/alternative; boundary="_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_"',
    Date: 'Mon, 25 Jul 2022 06:15:05 +0000',
    'Dkim-Signature': 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=outlook.com; s=selector1; h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-SenderADCheck; bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=; b=s+o1K3FMO1nKDL4kuurwOLY4NgdTYbTPMgEPhZLz2HxMBL6+ypCJeNJdGUq75lxul5ZO0HVRcwgABfgJ/dG/UubXikxmbPqghTeDW/2GeSwu0P6cu1SXuSiOeRstWnjdtLzNR3tX6VMP1WbEokRHtEl81vi9IReMRyZhxn6CBwiuMQ/HM9iYuAtw98HZeyWHquaaahXfkIA93XZDzah9wa0BkJ6IlgxJYlc5i654vyqpsP/ZdquubZO075ErGmHkgI79FGDZqces0KR/T1QMQYFFkihOtSva4akC2Yf+h/gZ77UmTgo4/pnWgU+gu3uf0H1jhbdQq8RyilRBsvwlWA==',
    From: 'dan dan <yep754@outlook.com>',
    'Message-Id': '<PU1PR01MB1979D5CD5D41E8583373098686959@PU1PR01MB1979.apcprd01.prod.exchangelabs.com>',
    'Mime-Version': '1.0',
    Msip_labels: '',
    Received: 'from PU1PR01MB1979.apcprd01.prod.exchangelabs.com ([fe80::34f4:eacf:740a:2733]) by PU1PR01MB1979.apcprd01.prod.exchangelabs.com ([fe80::34f4:eacf:740a:2733%3]) with mapi id 15.20.5458.024; Mon, 25 Jul 2022 06:15:05 +0000',
    Subject: 'UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018',
    'Thread-Index': 'AQHYn+3hbHdyNob8/UykZQdCSNTwjQ==',
    'Thread-Topic': 'UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018',
    To: '"wallet_test@mail.unipass.id" <wallet_test@mail.unipass.id>',
    'X-Envelope-From': 'yep754@outlook.com',
    'X-Mailgun-Incoming': 'Yes',
    'X-Microsoft-Antispam': 'BCL:0;',
    'X-Microsoft-Antispam-Message-Info': '3vS25MxuBTix84dxD+0kIQHcyXsTYnQWQZWaKmk9t5oQNnyyOACDClERYqC4yU6ZBhBE/urZ7/Idsd2YZQkBcw8RG2s0SPq+1iqSo6sSdT0myZVrwgz6S8z7tFT0yf2pCR+S9Xm6SxeJpSwiFmZyignMu7ixtJy1Q0DKD6IqEzS1M9woQI4HIPm1cTQOxJfMGyZBqbEQns3jiZWLo+yYIEcBREFKVhxF5XNQQG+nvU/JQtip4jZgcg5tvscMOS5Cnk51Kvm9YutWUc14RRqgEAyVzDgESgqR5sNHvcr0BK75ZnrYsq+gMpnGy5I6TRoMHi32pY+UoYRI0gIzKLdm287Clv1gHe2TUB54gG+3MZJ3bRZ1rm/adeIN0f26GqNHJR51jiRPcU/pTUVk47yP+a9d1IrsrEMl8ovJVsudZQhjhhb0OoW/jNJX6hcpbVVi2dt3ITKf/Ohku7WhNdtnfL/xjhpM0tJ6SPoRMyFGBe3FyVcrt/ijVIJf1vmD3Mxa5Z+0fkuB/Jsy1BUO6kpSCQ8stYJxJgIATKEC8gzgfGyDiVtqBkkY/YLiFIApoSJeZujRKf2mCki3kPP1brUh162alLGMTyHbWSHhboejZArYC1Uaq7J537iSD9yCTuRbTtkwy4qP4ny8oCcCoCx57w==',
    'X-Ms-Exchange-Antispam-Messagedata-0': '9h52E2THuH0s4PrBVd5CkoRy6fqYUBLA+lX1B5Gc5/ZdKZF93E8l+rQ9DlUMtHfNipOOuOb6uEtaw5BXNT2n5ns4vjsfXUeInoY36OLnEDHkypmJgGetoP/iaiIaKwAgN2pY5IhQrNKMMl/Ah7No4Hxycbfk3ol2tXdHSeVo8Q1kZb4yZdTx5MzCSv7G3TanBlf0AJigjiXXRH/iBBl8ZyVs6kMjLSmoNcenF0gDlCtGNYWDbE9YZ5gkMGFYQEfEszp7MS1bMaOE6VlSxKf305Jzg9zkZ0oKmh0U7JhopWqCMigeyM2r/h5hmo/J2Pem0t7QYEHc2trObJvXh9/YBA6817fpbyxj6LEKv4k+JSmCsjAy0MHI4ngg46aAURnqQDx27B/LJQEyyZq47vXHDFw0W0aJb2emRkhEoUttv4XQcr4YoOBBivBokrAijhcmyctKJjHZ+U4DwabZM47s6ymCabJjeL4zil42fdb/noH8gX9SMEboKckRRhO+GQWG0K+I1cKpcg1ISYoTnLFTvYtNdjzfIqFFPoerpbUq8URMT8glswpaeLSVoupjjY0FQmB4N9LjVR5fQnWrQrxHhYQt5BUES/iz5qvpIPwgVexWyc6vp8et/ECHYCz2I1fRR79VH2OVIcwzsSfZAiZR8fytu5nYY7zR5g2VC9GywsfHNjv+7AU2P0LSzcyOvsrjhguB/RB1jwhFPl5j6GaIkgj0K2ZCSmZ01xcQrDz5BDVYo7ssZtu8ItoctBJhF56d5AnWw1spWwBzUeHD7fl1JIEdhJiRz3l/iBUDbnICxJ08sOflCqUZ1Kv+mvpF0lD9D1NOjqOsTkn+X8n4mtLyBdORWs75vEcaXLlz7gefAbnH5DmkKRTsOAIfp1Xs85VMdsp/BKOCD0ohisnqshnpng1tIAi2LLt9gdNmAHEx9uEBy7QqamEtktHpwT/4KEbvwr6cQOUOacH48fIT5ZYYQ/PVf3WmVBXaiyDCAeqrkCsDnaH/kv/ytgVzuWP0dTM1eiU5C488WCZBY2xUQlXc/0ErRzzryP1WourD2ubrG9vp61k1Bu1CqYtRE3JGIdsL11jurQnwgRhodRUdSnXDukJ3l6gIrWmm4Ct3tTxFm4cdJjkiDF0DpWeF1NAJuzVbNQ2IRFYFcgbqIRMUiwPRtYhdZK+3OSdFLAJfdmk1fX7uh2fNxxJIuBX9XBgvc4HB7F0TojSYWsFviTwUSWYTCsdlj499+ZTDSxVZvujzLCdlYPj+4FxxPhypOAs9Ed9U',
    'X-Ms-Exchange-Antispam-Messagedata-Chunkcount': '1',
    'X-Ms-Exchange-Crosstenant-Authas': 'Internal',
    'X-Ms-Exchange-Crosstenant-Authsource': 'PU1PR01MB1979.apcprd01.prod.exchangelabs.com',
    'X-Ms-Exchange-Crosstenant-Fromentityheader': 'Hosted',
    'X-Ms-Exchange-Crosstenant-Id': '84df9e7f-e9f6-40af-b435-aaaaaaaaaaaa',
    'X-Ms-Exchange-Crosstenant-Network-Message-Id': '83215492-0209-4040-3e32-08da6e05043e',
    'X-Ms-Exchange-Crosstenant-Originalarrivaltime': '25 Jul 2022 06:15:05.1426 (UTC)',
    'X-Ms-Exchange-Crosstenant-Rms-Persistedconsumerorg': '00000000-0000-0000-0000-000000000000',
    'X-Ms-Exchange-Messagesentrepresentingtype': '1',
    'X-Ms-Exchange-Transport-Crosstenantheadersstamped': 'PSAPR01MB3814',
    'X-Ms-Has-Attach': '',
    'X-Ms-Office365-Filtering-Correlation-Id': '83215492-0209-4040-3e32-08da6e05043e',
    'X-Ms-Publictraffictype': 'Email',
    'X-Ms-Tnef-Correlator': '',
    'X-Ms-Traffictypediagnostic': 'PSAPR01MB3814:EE_',
    'X-Originatororg': 'outlook.com',
    'X-Tmn': '[4oueTM7wJQW9SQgTZxB/oo1Eg/gY329x]',
    'body-mime': 'Received: from APC01-PSA-obe.outbound.protection.outlook.com\r\n (mail-psaapc01olkn2013.outbound.protection.outlook.com [40.92.52.13]) by\r\n b965d380e476 with SMTP id <undefined> (version=TLS1.2,\r\n cipher=TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256); Mon, 25 Jul 2022 06:15:07\r\n UTC\r\nX-Envelope-From: yep754@outlook.com\r\nX-Mailgun-Incoming: Yes\r\nARC-Seal: i=1; a=rsa-sha256; s=arcselector9901; d=microsoft.com; cv=none;\r\n b=c5IJDi474sqLt6nswL4qXmuMnq9MmIO3nvGwp6wpekQ6B81Dc4/KvDM1KzvPICbeNtKmspBQnEebYABUYYejcCFk72pHRjT0X9eDMC6WlmJWxBfTap+j0Kn8pV8gQellObMkCD09mPftk2uRmZahE/LIKORR0Gut96vyPFocFvjx9WS5UEFfb3ui4XX99UiEZYiXvE9InGCQhzsQ8AxSJROzfzSHBYF69uJNIsUl9Jkl6RzA28NNy0A4RePhvUrKIp6gGDzkJc2FEsO7O8gPPuSAJ1UI1qxtfLtwrxHNhEQZ7fbUHceiwn4B1YxliyHghviUZ+ZC+gJj6GlMPalAXg==\r\nARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=microsoft.com;\r\n s=arcselector9901;\r\n h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-AntiSpam-MessageData-ChunkCount:X-MS-Exchange-AntiSpam-MessageData-0:X-MS-Exchange-AntiSpam-MessageData-1;\r\n bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=;\r\n b=S3kss/8NphyG4viETWasvUzbGkc3WuJBeAinQC3TERtweYc7M+TpzI82qvjKZxEnbzNRRUG9nMO/w0Z2RzbanVMomWTNPGy3O7R5Mc8fWKH5Ib2HvSyInki03TVlRxpi1YSo51vOrENzORb9Ld0ReWo0pIAL+Ebpokd+r4SAG+MVccOlcqca21zHiSWXLiPcaaejYtc+ghzjQYMFrmVEflz2KKWIq5WU2pL4KAcmEO1/PB9Q7a7CkXkh1YPjO+IPiLNGfsovjs+bYNP3S9eYCBWV4x/IMa4nu9p/i3xbiTOOPZbFYK2mJHHLJzrhv9qIqYz8/SZOgfuUBoqcQSsBew==\r\nARC-Authentication-Results: i=1; mx.microsoft.com 1; spf=none; dmarc=none;\r\n dkim=none; arc=none\r\nDKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=outlook.com;\r\n s=selector1;\r\n h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-SenderADCheck;\r\n bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=;\r\n b=s+o1K3FMO1nKDL4kuurwOLY4NgdTYbTPMgEPhZLz2HxMBL6+ypCJeNJdGUq75lxul5ZO0HVRcwgABfgJ/dG/UubXikxmbPqghTeDW/2GeSwu0P6cu1SXuSiOeRstWnjdtLzNR3tX6VMP1WbEokRHtEl81vi9IReMRyZhxn6CBwiuMQ/HM9iYuAtw98HZeyWHquaaahXfkIA93XZDzah9wa0BkJ6IlgxJYlc5i654vyqpsP/ZdquubZO075ErGmHkgI79FGDZqces0KR/T1QMQYFFkihOtSva4akC2Yf+h/gZ77UmTgo4/pnWgU+gu3uf0H1jhbdQq8RyilRBsvwlWA==\r\nReceived: from PU1PR01MB1979.apcprd01.prod.exchangelabs.com\r\n (2603:1096:803:1f::12) by PSAPR01MB3814.apcprd01.prod.exchangelabs.com\r\n (2603:1096:301:49::14) with Microsoft SMTP Server (version=TLS1_2,\r\n cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.5458.24; Mon, 25 Jul\r\n 2022 06:15:05 +0000\r\nReceived: from PU1PR01MB1979.apcprd01.prod.exchangelabs.com\r\n ([fe80::34f4:eacf:740a:2733]) by PU1PR01MB1979.apcprd01.prod.exchangelabs.com\r\n ([fe80::34f4:eacf:740a:2733%3]) with mapi id 15.20.5458.024; Mon, 25 Jul 2022\r\n 06:15:05 +0000\r\nFrom: dan dan <yep754@outlook.com>\r\nTo: "wallet_test@mail.unipass.id" <wallet_test@mail.unipass.id>\r\nSubject: UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018\r\nThread-Topic: \r\n UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018\r\nThread-Index: AQHYn+3hbHdyNob8/UykZQdCSNTwjQ==\r\nDate: Mon, 25 Jul 2022 06:15:05 +0000\r\nMessage-ID: \r\n <PU1PR01MB1979D5CD5D41E8583373098686959@PU1PR01MB1979.apcprd01.prod.exchangelabs.com>\r\nAccept-Language: zh-CN, en-US\r\nContent-Language: zh-CN\r\nX-MS-Has-Attach: \r\nX-MS-TNEF-Correlator: \r\nmsip_labels: \r\nx-ms-exchange-messagesentrepresentingtype: 1\r\nx-tmn: [4oueTM7wJQW9SQgTZxB/oo1Eg/gY329x]\r\nx-ms-publictraffictype: Email\r\nx-ms-office365-filtering-correlation-id: 83215492-0209-4040-3e32-08da6e05043e\r\nx-ms-traffictypediagnostic: PSAPR01MB3814:EE_\r\nx-microsoft-antispam: BCL:0;\r\nx-microsoft-antispam-message-info: \r\n 3vS25MxuBTix84dxD+0kIQHcyXsTYnQWQZWaKmk9t5oQNnyyOACDClERYqC4yU6ZBhBE/urZ7/Idsd2YZQkBcw8RG2s0SPq+1iqSo6sSdT0myZVrwgz6S8z7tFT0yf2pCR+S9Xm6SxeJpSwiFmZyignMu7ixtJy1Q0DKD6IqEzS1M9woQI4HIPm1cTQOxJfMGyZBqbEQns3jiZWLo+yYIEcBREFKVhxF5XNQQG+nvU/JQtip4jZgcg5tvscMOS5Cnk51Kvm9YutWUc14RRqgEAyVzDgESgqR5sNHvcr0BK75ZnrYsq+gMpnGy5I6TRoMHi32pY+UoYRI0gIzKLdm287Clv1gHe2TUB54gG+3MZJ3bRZ1rm/adeIN0f26GqNHJR51jiRPcU/pTUVk47yP+a9d1IrsrEMl8ovJVsudZQhjhhb0OoW/jNJX6hcpbVVi2dt3ITKf/Ohku7WhNdtnfL/xjhpM0tJ6SPoRMyFGBe3FyVcrt/ijVIJf1vmD3Mxa5Z+0fkuB/Jsy1BUO6kpSCQ8stYJxJgIATKEC8gzgfGyDiVtqBkkY/YLiFIApoSJeZujRKf2mCki3kPP1brUh162alLGMTyHbWSHhboejZArYC1Uaq7J537iSD9yCTuRbTtkwy4qP4ny8oCcCoCx57w==\r\nx-ms-exchange-antispam-messagedata-chunkcount: 1\r\nx-ms-exchange-antispam-messagedata-0: \r\n =?gb2312?B?OWg1MkUyVEh1SDBzNFByQlZkNUNrb1J5NmZxWVVCTEErbFgxQjVHYzUvWmRL?=\r\n =?gb2312?B?WkY5M0U4bCtyUTlEbFVNdEhmTmlwT091T2I2dUV0YXc1QlhOVDJuNW5zNHZq?=\r\n =?gb2312?B?c2ZYVWVJbm9ZMzZPTG5FREhreXBtSmdHZXRvUC9pYWlJYUt3QWdOMnBZNUlo?=\r\n =?gb2312?B?UXJOS01NbC9BaDdObzRIeHljYmZrM29sMnRYZEhTZVZvOFExa1piNHlaZFR4?=\r\n =?gb2312?B?NU16Q1N2N0czVGFuQmxmMEFKaWdqaVhYUkgvaUJCbDhaeVZzNmtNakxTbW9O?=\r\n =?gb2312?B?Y2VuRjBnRGxDdEdOWVdEYkU5WVo1Z2tNR0ZZUUVmRXN6cDdNUzFiTWFPRTZW?=\r\n =?gb2312?B?bFN4S2YzMDVKemc5emtaMG9LbWgwVTdKaG9wV3FDTWlnZXlNMnIvaDVobW8v?=\r\n =?gb2312?B?SjJQZW0wdDdRWUVIYzJ0ck9iSnZYaDkvWUJBNjgxN2ZwYnl4ajZMRUt2NGsr?=\r\n =?gb2312?B?SlNtQ3NqQXkwTUhJNG5nZzQ2YUFVUm5xUUR4MjdCL0xKUUV5eVpxNDd2WEhE?=\r\n =?gb2312?B?RncwVzBhSmIyZW1Sa2hFb1V0dHY0WFFjcjRZb09CQml2Qm9rckFpamhjbXlj?=\r\n =?gb2312?B?dEtKakhaK1U0RHdhYlpNNDdzNnltQ2FiSmplTDR6aWw0MmZkYi9ub0g4Z1g5?=\r\n =?gb2312?B?U01FYm9LY2tSUmhPK0dRV0cwSytJMWNLcGNnMUlTWW9UbkxGVHZZdE5kanpm?=\r\n =?gb2312?B?SXFGRlBvZXJwYlVxOFVSTVQ4Z2xzd3BhZUxTVm91cGpqWTBGUW1CNE45TGpW?=\r\n =?gb2312?B?UjVmUW5XclFyeEhoWVF0NUJVRVMvaXo1cXZwSVB3Z1ZleFd5YzZ2cDhldC9F?=\r\n =?gb2312?B?Q0hZQ3oySTFmUlI3OVZIMk9WSWN3enNTZlpBaVpSOGZ5dHU1bllZN3pSNWcy?=\r\n =?gb2312?B?VkM5R3l3c2ZITmp2KzdBVTJQMExTemN5T3ZzcmpoZ3VCL1JCMWp3aEZQbDVq?=\r\n =?gb2312?B?NkdhSWtnajBLMlpDU21aMDF4Y1FyRHo1QkRWWW83c3NadHU4SXRvY3RCSmhG?=\r\n =?gb2312?B?NTZkNUFuV3cxc3BXd0J6VWVIRDdmbDFKSUVkaEppUnozbC9pQlVEYm5JQ3hK?=\r\n =?gb2312?B?MDhzT2ZsQ3FVWjFLdittdnBGMGxEOUQxTk9qcU9zVGtuK1g4bjRtdEx5QmRP?=\r\n =?gb2312?B?UldzNzV2RWNhWExsejdnZWZBYm5INURta0tSVHNPQUlmcDFYczg1Vk1kc3Av?=\r\n =?gb2312?B?QktPQ0Qwb2hpc25xc2hucG5nMXRJQWkyTEx0OWdkTm1BSEV4OXVFQnk3UXFh?=\r\n =?gb2312?B?bUV0a3RIcHdULzRLRWJ2d3I2Y1FPVU9hY0g0OGZJVDVaWVlRL1BWZjNXbVZC?=\r\n =?gb2312?B?WGFpeURDQWVxcmtDc0RuYUgva3YveXRnVnp1V1AwZFRNMWVpVTVDNDg4V0Na?=\r\n =?gb2312?B?QlkyeFVRbFhjLzBFclJ6enJ5UDFXb3VyRDJ1YnJHOXZwNjFrMUJ1MUNxWXRS?=\r\n =?gb2312?B?RTNKR0lkc0wxMWp1clFud2dSaG9kUlVkU25YRHVrSjNsNmdJcldtbTRDdDN0?=\r\n =?gb2312?B?VHhGbTRjZEpqa2lERjBEcFdlRjFOQUp1elZiTlEySVJGWUZjZ2JxSVJNVWl3?=\r\n =?gb2312?B?UFJ0WWhkWksrM09TZEZMQUpmZG1rMWZYN3VoMmZOeHhKSXVCWDlYQmd2YzRI?=\r\n =?gb2312?B?QjdGMFRvalNZV3NGdmlUd1VTV1lUQ3NkbGo0OTkrWlREU3hWWnZ1anpMQ2Rs?=\r\n =?gb2312?Q?YPj+4FxxPhypOAs9Ed9U?=\r\nContent-Type: multipart/alternative;\r\n\tboundary="_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_"\r\nMIME-Version: 1.0\r\nX-OriginatorOrg: outlook.com\r\nX-MS-Exchange-CrossTenant-AuthAs: Internal\r\nX-MS-Exchange-CrossTenant-AuthSource: PU1PR01MB1979.apcprd01.prod.exchangelabs.com\r\nX-MS-Exchange-CrossTenant-RMS-PersistedConsumerOrg: 00000000-0000-0000-0000-000000000000\r\nX-MS-Exchange-CrossTenant-Network-Message-Id: 83215492-0209-4040-3e32-08da6e05043e\r\nX-MS-Exchange-CrossTenant-originalarrivaltime: 25 Jul 2022 06:15:05.1426\r\n (UTC)\r\nX-MS-Exchange-CrossTenant-fromentityheader: Hosted\r\nX-MS-Exchange-CrossTenant-id: 84df9e7f-e9f6-40af-b435-aaaaaaaaaaaa\r\nX-MS-Exchange-CrossTenant-rms-persistedconsumerorg: 00000000-0000-0000-0000-000000000000\r\nX-MS-Exchange-Transport-CrossTenantHeadersStamped: PSAPR01MB3814\r\n\r\n--_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_\nContent-Type: text/plain; charset="gb2312"\r\nContent-Transfer-Encoding: base64\r\n\r\nUGxlYXNlIHNlbmQgdGhpcyBlbWFpbCBkaXJlY3RseSB3aXRoIG5vIG1vZGlmaWNhdGlvbi4NCg==\r\n\n--_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_\nContent-Type: text/html; charset="gb2312"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n<html>\r\n<head>\r\n<meta http-equiv=3D"Content-Type" content=3D"text/html; charset=3Dgb2312">\r\n<style type=3D"text/css" style=3D"display:none;"> P {margin-top:0;margin-bo=\r\nttom:0;} </style>\r\n</head>\r\n<body dir=3D"ltr">\r\n<div>Please send this email directly with no modification.</div>\r\n</body>\r\n</html>\r\n\n--_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_--\n',
    from: 'dan dan <yep754@outlook.com>',
    'message-headers': '[["Received","from APC01-PSA-obe.outbound.protection.outlook.com (mail-psaapc01olkn2013.outbound.protection.outlook.com [40.92.52.13]) by b965d380e476 with SMTP id <undefined> (version=TLS1.2, cipher=TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256); Mon, 25 Jul 2022 06:15:07 UTC"],["Received","from PU1PR01MB1979.apcprd01.prod.exchangelabs.com (2603:1096:803:1f::12) by PSAPR01MB3814.apcprd01.prod.exchangelabs.com (2603:1096:301:49::14) with Microsoft SMTP Server (version=TLS1_2, cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.5458.24; Mon, 25 Jul 2022 06:15:05 +0000"],["Received","from PU1PR01MB1979.apcprd01.prod.exchangelabs.com ([fe80::34f4:eacf:740a:2733]) by PU1PR01MB1979.apcprd01.prod.exchangelabs.com ([fe80::34f4:eacf:740a:2733%3]) with mapi id 15.20.5458.024; Mon, 25 Jul 2022 06:15:05 +0000"],["X-Envelope-From","yep754@outlook.com"],["X-Mailgun-Incoming","Yes"],["Arc-Seal","i=1; a=rsa-sha256; s=arcselector9901; d=microsoft.com; cv=none; b=c5IJDi474sqLt6nswL4qXmuMnq9MmIO3nvGwp6wpekQ6B81Dc4/KvDM1KzvPICbeNtKmspBQnEebYABUYYejcCFk72pHRjT0X9eDMC6WlmJWxBfTap+j0Kn8pV8gQellObMkCD09mPftk2uRmZahE/LIKORR0Gut96vyPFocFvjx9WS5UEFfb3ui4XX99UiEZYiXvE9InGCQhzsQ8AxSJROzfzSHBYF69uJNIsUl9Jkl6RzA28NNy0A4RePhvUrKIp6gGDzkJc2FEsO7O8gPPuSAJ1UI1qxtfLtwrxHNhEQZ7fbUHceiwn4B1YxliyHghviUZ+ZC+gJj6GlMPalAXg=="],["Arc-Message-Signature","i=1; a=rsa-sha256; c=relaxed/relaxed; d=microsoft.com; s=arcselector9901; h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-AntiSpam-MessageData-ChunkCount:X-MS-Exchange-AntiSpam-MessageData-0:X-MS-Exchange-AntiSpam-MessageData-1; bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=; b=S3kss/8NphyG4viETWasvUzbGkc3WuJBeAinQC3TERtweYc7M+TpzI82qvjKZxEnbzNRRUG9nMO/w0Z2RzbanVMomWTNPGy3O7R5Mc8fWKH5Ib2HvSyInki03TVlRxpi1YSo51vOrENzORb9Ld0ReWo0pIAL+Ebpokd+r4SAG+MVccOlcqca21zHiSWXLiPcaaejYtc+ghzjQYMFrmVEflz2KKWIq5WU2pL4KAcmEO1/PB9Q7a7CkXkh1YPjO+IPiLNGfsovjs+bYNP3S9eYCBWV4x/IMa4nu9p/i3xbiTOOPZbFYK2mJHHLJzrhv9qIqYz8/SZOgfuUBoqcQSsBew=="],["Arc-Authentication-Results","i=1; mx.microsoft.com 1; spf=none; dmarc=none; dkim=none; arc=none"],["Dkim-Signature","v=1; a=rsa-sha256; c=relaxed/relaxed; d=outlook.com; s=selector1; h=From:Date:Subject:Message-ID:Content-Type:MIME-Version:X-MS-Exchange-SenderADCheck; bh=VfFaAUw2Do/8YRPRHjciaoGOw27QpAK9f5+ZCWgUhmE=; b=s+o1K3FMO1nKDL4kuurwOLY4NgdTYbTPMgEPhZLz2HxMBL6+ypCJeNJdGUq75lxul5ZO0HVRcwgABfgJ/dG/UubXikxmbPqghTeDW/2GeSwu0P6cu1SXuSiOeRstWnjdtLzNR3tX6VMP1WbEokRHtEl81vi9IReMRyZhxn6CBwiuMQ/HM9iYuAtw98HZeyWHquaaahXfkIA93XZDzah9wa0BkJ6IlgxJYlc5i654vyqpsP/ZdquubZO075ErGmHkgI79FGDZqces0KR/T1QMQYFFkihOtSva4akC2Yf+h/gZ77UmTgo4/pnWgU+gu3uf0H1jhbdQq8RyilRBsvwlWA=="],["From","dan dan <yep754@outlook.com>"],["To","\\"wallet_test@mail.unipass.id\\" <wallet_test@mail.unipass.id>"],["Subject","UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018"],["Thread-Topic","UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018"],["Thread-Index","AQHYn+3hbHdyNob8/UykZQdCSNTwjQ=="],["Date","Mon, 25 Jul 2022 06:15:05 +0000"],["Message-Id","<PU1PR01MB1979D5CD5D41E8583373098686959@PU1PR01MB1979.apcprd01.prod.exchangelabs.com>"],["Accept-Language","zh-CN, en-US"],["Content-Language","zh-CN"],["X-Ms-Has-Attach",""],["X-Ms-Tnef-Correlator",""],["Msip_labels",""],["X-Ms-Exchange-Messagesentrepresentingtype","1"],["X-Tmn","[4oueTM7wJQW9SQgTZxB/oo1Eg/gY329x]"],["X-Ms-Publictraffictype","Email"],["X-Ms-Office365-Filtering-Correlation-Id","83215492-0209-4040-3e32-08da6e05043e"],["X-Ms-Traffictypediagnostic","PSAPR01MB3814:EE_"],["X-Microsoft-Antispam","BCL:0;"],["X-Microsoft-Antispam-Message-Info","3vS25MxuBTix84dxD+0kIQHcyXsTYnQWQZWaKmk9t5oQNnyyOACDClERYqC4yU6ZBhBE/urZ7/Idsd2YZQkBcw8RG2s0SPq+1iqSo6sSdT0myZVrwgz6S8z7tFT0yf2pCR+S9Xm6SxeJpSwiFmZyignMu7ixtJy1Q0DKD6IqEzS1M9woQI4HIPm1cTQOxJfMGyZBqbEQns3jiZWLo+yYIEcBREFKVhxF5XNQQG+nvU/JQtip4jZgcg5tvscMOS5Cnk51Kvm9YutWUc14RRqgEAyVzDgESgqR5sNHvcr0BK75ZnrYsq+gMpnGy5I6TRoMHi32pY+UoYRI0gIzKLdm287Clv1gHe2TUB54gG+3MZJ3bRZ1rm/adeIN0f26GqNHJR51jiRPcU/pTUVk47yP+a9d1IrsrEMl8ovJVsudZQhjhhb0OoW/jNJX6hcpbVVi2dt3ITKf/Ohku7WhNdtnfL/xjhpM0tJ6SPoRMyFGBe3FyVcrt/ijVIJf1vmD3Mxa5Z+0fkuB/Jsy1BUO6kpSCQ8stYJxJgIATKEC8gzgfGyDiVtqBkkY/YLiFIApoSJeZujRKf2mCki3kPP1brUh162alLGMTyHbWSHhboejZArYC1Uaq7J537iSD9yCTuRbTtkwy4qP4ny8oCcCoCx57w=="],["X-Ms-Exchange-Antispam-Messagedata-Chunkcount","1"],["X-Ms-Exchange-Antispam-Messagedata-0","9h52E2THuH0s4PrBVd5CkoRy6fqYUBLA+lX1B5Gc5/ZdKZF93E8l+rQ9DlUMtHfNipOOuOb6uEtaw5BXNT2n5ns4vjsfXUeInoY36OLnEDHkypmJgGetoP/iaiIaKwAgN2pY5IhQrNKMMl/Ah7No4Hxycbfk3ol2tXdHSeVo8Q1kZb4yZdTx5MzCSv7G3TanBlf0AJigjiXXRH/iBBl8ZyVs6kMjLSmoNcenF0gDlCtGNYWDbE9YZ5gkMGFYQEfEszp7MS1bMaOE6VlSxKf305Jzg9zkZ0oKmh0U7JhopWqCMigeyM2r/h5hmo/J2Pem0t7QYEHc2trObJvXh9/YBA6817fpbyxj6LEKv4k+JSmCsjAy0MHI4ngg46aAURnqQDx27B/LJQEyyZq47vXHDFw0W0aJb2emRkhEoUttv4XQcr4YoOBBivBokrAijhcmyctKJjHZ+U4DwabZM47s6ymCabJjeL4zil42fdb/noH8gX9SMEboKckRRhO+GQWG0K+I1cKpcg1ISYoTnLFTvYtNdjzfIqFFPoerpbUq8URMT8glswpaeLSVoupjjY0FQmB4N9LjVR5fQnWrQrxHhYQt5BUES/iz5qvpIPwgVexWyc6vp8et/ECHYCz2I1fRR79VH2OVIcwzsSfZAiZR8fytu5nYY7zR5g2VC9GywsfHNjv+7AU2P0LSzcyOvsrjhguB/RB1jwhFPl5j6GaIkgj0K2ZCSmZ01xcQrDz5BDVYo7ssZtu8ItoctBJhF56d5AnWw1spWwBzUeHD7fl1JIEdhJiRz3l/iBUDbnICxJ08sOflCqUZ1Kv+mvpF0lD9D1NOjqOsTkn+X8n4mtLyBdORWs75vEcaXLlz7gefAbnH5DmkKRTsOAIfp1Xs85VMdsp/BKOCD0ohisnqshnpng1tIAi2LLt9gdNmAHEx9uEBy7QqamEtktHpwT/4KEbvwr6cQOUOacH48fIT5ZYYQ/PVf3WmVBXaiyDCAeqrkCsDnaH/kv/ytgVzuWP0dTM1eiU5C488WCZBY2xUQlXc/0ErRzzryP1WourD2ubrG9vp61k1Bu1CqYtRE3JGIdsL11jurQnwgRhodRUdSnXDukJ3l6gIrWmm4Ct3tTxFm4cdJjkiDF0DpWeF1NAJuzVbNQ2IRFYFcgbqIRMUiwPRtYhdZK+3OSdFLAJfdmk1fX7uh2fNxxJIuBX9XBgvc4HB7F0TojSYWsFviTwUSWYTCsdlj499+ZTDSxVZvujzLCdlYPj+4FxxPhypOAs9Ed9U"],["Content-Type","multipart/alternative; boundary=\\"_000_PU1PR01MB1979D5CD5D41E8583373098686959PU1PR01MB1979apcp_\\""],["Mime-Version","1.0"],["X-Originatororg","outlook.com"],["X-Ms-Exchange-Crosstenant-Authas","Internal"],["X-Ms-Exchange-Crosstenant-Authsource","PU1PR01MB1979.apcprd01.prod.exchangelabs.com"],["X-Ms-Exchange-Crosstenant-Rms-Persistedconsumerorg","00000000-0000-0000-0000-000000000000"],["X-Ms-Exchange-Crosstenant-Rms-Persistedconsumerorg","00000000-0000-0000-0000-000000000000"],["X-Ms-Exchange-Crosstenant-Network-Message-Id","83215492-0209-4040-3e32-08da6e05043e"],["X-Ms-Exchange-Crosstenant-Originalarrivaltime","25 Jul 2022 06:15:05.1426 (UTC)"],["X-Ms-Exchange-Crosstenant-Fromentityheader","Hosted"],["X-Ms-Exchange-Crosstenant-Id","84df9e7f-e9f6-40af-b435-aaaaaaaaaaaa"],["X-Ms-Exchange-Transport-Crosstenantheadersstamped","PSAPR01MB3814"]]',
    recipient: 'wallet_test@mail.unipass.id',
    sender: 'yep754@outlook.com',
    signature: 'e9d600af2dc793bfdb20b7d3e3dfaa56311c5dbe36f9f7a7d94e5d9a2394ac1a',
    subject: 'UP0x311eb8a8b4adea321d0ebe14d9a65cb60635f62595a84e55d080264defc38018',
    timestamp: '1658731212',
    token: 'edaf911f404f7c8b5c0d779f2ae05b0d119be305ef84acfc48',
};
