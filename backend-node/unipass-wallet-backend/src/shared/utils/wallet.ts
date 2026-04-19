import { Wallet, getAddress, solidityPacked, keccak256, getBytes } from 'ethers';
import { subDigest } from '@unipasswallet/utils';
import { KeyERC1271, KeyEmailDkim, KeyEmailDkimSignType, KeyOpenIDSignType, KeySecp256k1, KeySecp256k1Wallet, Keyset, RoleWeight, SignType, sign } from '@unipasswallet/keys';
import { BadRequestException } from '@nestjs/common';
import { StatusName } from './status.msg.code';
import { KeyType } from '../../interfaces';
import { DkimParamsBase } from '@unipasswallet/dkim';
import { getFuzzyEmail } from './mycrypto';
import { MAINNET_UNIPASS_WALLET_CONTEXT, TESTNET_UNIPASS_WALLET_CONTEXT } from '@unipasswallet/network';

export enum Role {
    Owner = 0,
    AssetsOp = 1,
    Guardian = 2,
}
require("dotenv/config");
// ethers v6: solidityPacked and keccak256 imported from 'ethers' directly
export function getKeyEmailInfo(key) {
    const itemKey = key;
    let emailFrom = itemKey.emailFrom;
    let emailHash = itemKey.emailHash;
    let pepper = itemKey.pepper;
    const roleWeight = key.roleWeight;
    if (!emailFrom) {
        const keyOpenIDWithEmail = key;
        if (keyOpenIDWithEmail.emailOptionsOrEmailHash &&
            typeof keyOpenIDWithEmail.emailOptionsOrEmailHash !== 'string') {
            emailFrom = keyOpenIDWithEmail.emailOptionsOrEmailHash.emailFrom;
            emailHash = keyOpenIDWithEmail.emailOptionsOrEmailHash.emailHash;
            pepper = keyOpenIDWithEmail.emailOptionsOrEmailHash.pepper;
        }
    }
    return { emailFrom, emailHash, roleWeight, pepper };
}
export function getPermitMessage(sessionKeyAddress, timestamp, weight, userAddr) {
    return subDigest(0, userAddr, keccak256(solidityPacked(['address', 'uint32', 'uint32'], [sessionKeyAddress, timestamp, weight])));
}
export async function signerSign(hash, signer) {
    return solidityPacked(['bytes', 'uint8'], [await signer.signMessage(getBytes(hash)), 2]);
}
export function getKeyERC1271PolicyData(roleWeight) {
    const keyset = Keyset.fromJson(process.env.POLICY_KEYSET_JSON);
    const policyAddress = process.env.POLICY_ADDRESS;
    if (KeySecp256k1.isKeySecp256k1(keyset.keys[1])) {
        const addr = keyset.keys[1].address;
        const privateKey = process.env.PRIVATE_KEY;
        const wallet = new Wallet(privateKey);
        keyset.keys[1].signFunc = async (digestHash, signType) => {
            if (wallet.address.toLocaleLowerCase() !== addr) {
                throw new BadRequestException(StatusName.POLICY_KEY_INVALID);
            }
            return sign(digestHash, wallet, signType);
        };
    }
    else {
        throw new BadRequestException(StatusName.POLICY_KEY_INVALID);
    }
    // NOTE: original decompiled behaviour — constructor signature diverges from
    // stock ethers.Wallet but matches historical unipass tooling; cast through any.
    const policyWallet = new (Wallet as any)({ address: policyAddress, keyset });
    const policy = new KeyERC1271(policyWallet.address, roleWeight, async (digestHash: any) => await (policyWallet as any).signMessage(getBytes(digestHash), [1]));
    return policy;
}
export function getKeySecp256k1PolicyData(keyset) {
    if (KeySecp256k1.isKeySecp256k1(keyset)) {
        const addr = keyset.address;
        const privateKey = process.env.PRIVATE_KEY;
        const wallet = new Wallet(privateKey);
        keyset.signFunc = async (digestHash, signType) => {
            if (wallet.address.toLocaleLowerCase() !== addr) {
                throw new Error('Invalid Operate Key');
            }
            return sign(digestHash, wallet, signType);
        };
    }
    else {
        throw new Error('Invalid Keyset');
    }
    return keyset;
}
export function getPolicyData(roleWeight: any, policyKey?: any) {
    const policy = KeySecp256k1.isKeySecp256k1(policyKey)
        ? getKeySecp256k1PolicyData(policyKey)
        : getKeyERC1271PolicyData(roleWeight);
    return policy;
}
export function getPolicyEoaAddress() {
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = new Wallet(privateKey);
    return wallet.address;
}
export function keysetIsPolicy(keysetJson: any, logger: any, keyset?: any) {
    if (!keyset) {
        try {
            keyset = Keyset.fromJson(keysetJson);
        }
        catch (error) {
            logger.error(`[getKeysetData] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
                keysetJson,
            })}`);
            throw new BadRequestException(StatusName.KEYSET_ERROR);
        }
    }
    const isPolicy = keyset.keys.length > 3 ? false : true;
    return isPolicy;
}
export function checkKeysetPolicy(keyset) {
    const policyKey = keyset.keys[keyset.keys.length - 1];
    const privateKey = process.env.PRIVATE_KEY;
    const policyAddress = process.env.POLICY_ADDRESS;
    const wallet = new Wallet(privateKey);
    if ((KeySecp256k1.isKeySecp256k1(policyKey) &&
        policyKey.address.toLocaleLowerCase() ===
            wallet.address.toLocaleLowerCase()) ||
        (KeyERC1271.isKeyERC1271(policyKey) &&
            policyAddress.toLocaleLowerCase() ===
                policyKey.address.toLocaleLowerCase())) {
        return true;
    }
    return false;
}
export function getKeysetData(keysetJson: any, logger: any, email?: any, keyType?: any) {
    let keyset;
    try {
        keyset = Keyset.fromJson(keysetJson);
    }
    catch (error) {
        logger.error(`[getKeysetData]${error},${(error as Error)?.stack},data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
    const originEmails = [];
    const keyTypeList = [
        KeyType.AWS_KMS,
        KeyType.CUSTOM_AUTH,
        KeyType.CUSTOM_AUTH_EOA,
    ];
    const notCheckKeyType = keyType && !keyTypeList.includes(keyType);
    try {
        if (notCheckKeyType && email) {
            const { emailFrom } = getKeyEmailInfo(keyset.keys[1]);
            if (email !== emailFrom) {
                logger.warn(`[getKeysetData] email:${email},keyset emailFrom:${emailFrom}`);
                throw new BadRequestException(StatusName.KEYSET_ERROR);
            }
        }
    }
    catch (_a) {
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
    if (notCheckKeyType && !checkKeysetPolicy(keyset)) {
        throw new BadRequestException(StatusName.POLICY_KEY_INVALID);
    }
    for (const item of keyset.keys) {
        const keyEmailDkim = item;
        if (!keyEmailDkim.emailFrom) {
            continue;
        }
        originEmails.push(keyEmailDkim.emailFrom);
    }
    return { keyset, originEmails };
}
export const isOnlyChangeGuardian = (oldKeysetJson, newKeysetJson, logger) => {
    try {
        const oldKeyset = Keyset.fromJson(oldKeysetJson);
        const newKeyset = Keyset.fromJson(newKeysetJson);
        if (oldKeyset.hash() === newKeyset.hash()) {
            return false;
        }
        const oldMasterKey = oldKeyset.keys[0];
        const newMasterKey = newKeyset.keys[0];
        if (oldMasterKey.address !== newMasterKey.address) {
            return false;
        }
        const oldRegisterEmail = oldKeyset.keys[1];
        const newRegisterEmail = newKeyset.keys[1];
        const { emailHash: oldEmailHash } = getKeyEmailInfo(oldKeyset.keys[1]);
        const { emailHash: newEmailHash } = getKeyEmailInfo(newKeyset.keys[1]);
        if (typeof oldRegisterEmail.emailOptionsOrEmailHash === 'string') {
            if (oldRegisterEmail.emailOptionsOrEmailHash !==
                newRegisterEmail.emailOptionsOrEmailHash) {
                return false;
            }
        }
        else {
            if (oldEmailHash !== newEmailHash) {
                return false;
            }
        }
        const oldPolicyKey = oldKeyset.keys[oldKeyset.keys.length - 1];
        const newPolicyKey = newKeyset.keys[newKeyset.keys.length - 1];
        if (oldPolicyKey.address !== newPolicyKey.address) {
            return false;
        }
        return true;
    }
    catch (error) {
        logger.error(`[isOnlyChangeGuardian] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
            oldKeysetJson,
            newKeysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
};
export const checkGuardIsRepeated = (keysetJson, logger) => {
    try {
        const keyset = Keyset.fromJson(keysetJson);
        const registerEmail = keyset.keys[1];
        const { emailFrom } = getKeyEmailInfo(registerEmail);
        const emailMap = new Map();
        emailMap.set(emailFrom, 1);
        const guardianList = keyset.keys.slice(2, -1);
        for (const item of guardianList) {
            const keyEmailDkim = item;
            if (emailMap.get(keyEmailDkim.emailFrom)) {
                if (logger) {
                    logger.warn(`update guardian have repeated ,the email is ${keyEmailDkim.emailFrom}`);
                }
                return true;
            }
            emailMap.set(keyEmailDkim.emailFrom, 1);
        }
        return false;
    }
    catch (_a) {
        return true;
    }
};
export function updateKeysetByMasterKey(newMasterKeyAddress, keysetJson, logger) {
    try {
        const keyset = Keyset.fromJson(keysetJson);
        const masterRoleWeight = keyset.keys[0].roleWeight;
        const masterKeyData = new KeySecp256k1(newMasterKeyAddress, masterRoleWeight, SignType.EthSign, async () => Promise.resolve(''));
        keyset.keys[0] = masterKeyData;
        return keyset;
    }
    catch (error) {
        logger.error(`[updateKeysetByMasterKey]${error},${(error as Error)?.stack},data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
function getGuardianWeight(guardianWeight, isPolicy) {
    const sendRecoveryEmailWeight = {
        canSendStartRecoveryTx: false,
        isHaveTimeLock: true,
        isPolicy,
        score: guardianWeight,
    };
    if (guardianWeight >= 100) {
        sendRecoveryEmailWeight.canSendStartRecoveryTx = true;
        sendRecoveryEmailWeight.isHaveTimeLock = false;
    }
    else if (guardianWeight < 100 && guardianWeight >= 50) {
        sendRecoveryEmailWeight.canSendStartRecoveryTx = true;
        sendRecoveryEmailWeight.isHaveTimeLock = true;
    }
    else {
        sendRecoveryEmailWeight.canSendStartRecoveryTx = false;
        sendRecoveryEmailWeight.isHaveTimeLock = false;
    }
    return sendRecoveryEmailWeight;
}
function getEmailMap(zkParams, dkimParams, verificationEmail) {
    const emailsMap = new Map();
    for (const item of zkParams) {
        if (verificationEmail.includes(item[0])) {
            emailsMap.set(item[0], item);
        }
    }
    for (const item of dkimParams) {
        if (verificationEmail.includes(item[0])) {
            emailsMap.set(item[0], item);
        }
    }
    return emailsMap;
}
export function calculateGuardianWeight(keysetJson, zkParams, dkimParams, verificationEmail, logger, isPolicy, idToken) {
    try {
        const keyset = Keyset.fromJson(keysetJson);
        const emailsMap = getEmailMap(zkParams, dkimParams, verificationEmail);
        let guardianWeight = 0;
        const { emailFrom, roleWeight: openIdkeyRoleWeight } = getKeyEmailInfo(keyset.keys[1]);
        if (emailFrom) {
            logger.log(`calculateGuardianWeight getKeyEmailInfo=${JSON.stringify({
                emailFrom,
                openIdkeyRoleWeight,
                idToken,
            })}`);
            if (emailsMap.get(emailFrom)) {
                guardianWeight += openIdkeyRoleWeight.ownerWeight;
            }
            else if (idToken) {
                guardianWeight += openIdkeyRoleWeight.guardianWeight;
            }
        }
        for (const item of keyset.keys) {
            const keyEmailDkim = item;
            const roleWeight = item.roleWeight;
            if (!keyEmailDkim.emailFrom) {
                continue;
            }
            if (!emailsMap.get(keyEmailDkim.emailFrom)) {
                continue;
            }
            guardianWeight += roleWeight.guardianWeight;
        }
        if (isPolicy) {
            guardianWeight +=
                keyset.keys[keyset.keys.length - 1].roleWeight.ownerWeight;
        }
        const sendRecoveryEmailWeight = getGuardianWeight(guardianWeight, isPolicy);
        return sendRecoveryEmailWeight;
    }
    catch (error) {
        logger.error(`[getKeysetData] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
function getZkParams(zKParamsJson) {
    const zKParams = JSON.parse(zKParamsJson);
    const domainSize = BigInt(zKParams.domainSize);
    const txZkData = {
        zKParams: {
            domainSize,
            publicInputs: zKParams.publicInputs,
            vkData: zKParams.vkData,
            proof: zKParams.proof,
        },
        headerPubMatch: zKParams.headerPubMatch,
    };
    return txZkData;
}
export function buildDkimSigKeyset(keyset, zkParamsList, emailHeader, isPolicy, email, idToken) {
    let keyIndexList = [];
    if (isPolicy) {
        const policyKey = keyset.keys[keyset.keys.length - 1];
        keyset.keys[keyset.keys.length - 1] = getPolicyData(policyKey.roleWeight, policyKey);
    }
    const dkimParamsMap = new Map();
    const zkParamsMap = new Map();
    for (const item of zkParamsList) {
        zkParamsMap.set(item[0], getZkParams(item[1]));
    }
    for (const item of emailHeader) {
        dkimParamsMap.set(item[0], DkimParamsBase.fromString(item[1]));
    }
    let keyOpenIDWithEmail = keyset.keys[1];
    let zkParams = zkParamsMap.get(email);
    let dkimParamsParams = dkimParamsMap.get(email);
    let index = 0;
    if (idToken) {
        keyOpenIDWithEmail = keyOpenIDWithEmail
            .updateIDToken(idToken)
            .updateSignType(KeyOpenIDSignType.OpenIDSign);
        keyIndexList = [1];
    }
    else if (zkParams && dkimParamsParams) {
        dkimParamsParams = dkimParamsParams.updateEmailHeader(zkParams.headerPubMatch);
        keyOpenIDWithEmail = keyOpenIDWithEmail
            .updateZKParams(zkParams.zKParams)
            .updateDkimParams(dkimParamsParams)
            .updateEmailDkimSignType(KeyEmailDkimSignType.DkimZK)
            .updateSignType(KeyOpenIDSignType.EmailSign);
        keyIndexList = [1];
    }
    else {
        keyIndexList = [];
    }
    for (const item of keyset.keys) {
        let keyEmailDkim = item;
        if (!keyEmailDkim.emailFrom) {
            index++;
            continue;
        }
        zkParams = zkParamsMap.get(keyEmailDkim.emailFrom);
        dkimParamsParams = dkimParamsMap.get(keyEmailDkim.emailFrom);
        if (zkParams && dkimParamsParams) {
            dkimParamsParams = dkimParamsParams.updateEmailHeader(zkParams.headerPubMatch);
            keyEmailDkim = keyEmailDkim
                .updateZKParams(zkParams.zKParams)
                .updateDkimParams(dkimParamsParams)
                .updateEmailSignType(KeyEmailDkimSignType.DkimZK);
            keyset.keys[index] = keyEmailDkim;
            keyIndexList.push(index);
        }
        index++;
    }
    keyset.keys[1] = keyOpenIDWithEmail;
    if (isPolicy) {
        keyIndexList.push(keyset.keys.length - 1);
    }
    return { keyset, keyIndexList };
}
export function getMasterSigKeyset(keyset, masterKeySig) {
    const signFunc = (digestHash, signType) => Promise.resolve(masterKeySig);
    const masterKey = keyset.keys[0];
    masterKey.signFunc = signFunc;
    keyset.keys[0] = masterKey;
    const policyKey = keyset.keys[keyset.keys.length - 1];
    keyset.keys[keyset.keys.length - 1] = getPolicyData(policyKey.roleWeight, policyKey);
    const keyIndexList = [0, keyset.keys.length - 1];
    return { keyset, keyIndexList };
}
export function buildSyncAccountKeyset(keyset, zKParams, dkimParamsString, idToken) {
    const policyKey = keyset.keys[keyset.keys.length - 1];
    keyset.keys[keyset.keys.length - 1] = getPolicyData(policyKey.roleWeight, policyKey);
    let registerKey = keyset.keys[1];
    let keyIndexList = [];
    if (zKParams && dkimParamsString) {
        const txZkData = getZkParams(zKParams);
        let dkimParams = DkimParamsBase.fromString(dkimParamsString);
        dkimParams = dkimParams.updateEmailHeader(txZkData.headerPubMatch);
        registerKey = registerKey
            .updateZKParams(txZkData.zKParams)
            .updateDkimParams(dkimParams)
            .updateEmailDkimSignType(KeyEmailDkimSignType.DkimZK)
            .updateSignType(KeyOpenIDSignType.EmailSign);
        keyIndexList = [1];
    }
    else if (idToken) {
        registerKey = registerKey
            .updateIDToken(idToken)
            .updateSignType(KeyOpenIDSignType.OpenIDSign);
        keyIndexList = [1];
    }
    else {
        keyIndexList = [];
    }
    keyset.keys[1] = registerKey;
    keyIndexList.push(keyset.keys.length - 1);
    return { keyset, keyIndexList };
}
export function hideSecurityInformation(keysetData, logger) {
    try {
        const keyset = Keyset.fromJson(keysetData.keyset);
        const keys = keyset.keys;
        for (const [index, item] of keys.entries()) {
            if (index < 2) {
                continue;
            }
            const key = item;
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
        logger.error(`[hideSecurityInformation] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
            keysetJson: keysetData.keyset,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
export function getKeysetEmailPepperInfo(keysetJson, logger) {
    try {
        const keyset = Keyset.fromJson(keysetJson);
        const keys = keyset.keys;
        const emailInfos = [];
        const { emailFrom, pepper } = getKeyEmailInfo(keyset.keys[1]);
        if (emailFrom) {
            emailInfos.push({ email: emailFrom, pepper });
        }
        for (const item of keys) {
            const key = item;
            if (!key.emailFrom) {
                continue;
            }
            emailInfos.push({ email: key.emailFrom, pepper: key.pepper });
        }
        return emailInfos;
    }
    catch (error) {
        logger.error(`[getKeysetEmailPepperInfo] ${error} ,data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
export function getEmailRawDataByHashs(emailHashs, keysetJson, logger) {
    try {
        const keyset = Keyset.fromJson(keysetJson);
        const keys = keyset.keys;
        const emailInfos = [];
        const { emailFrom, emailHash, pepper } = getKeyEmailInfo(keyset.keys[1]);
        if (emailFrom && emailHashs.includes(emailHash)) {
            emailInfos.push({ email: emailFrom, pepper });
        }
        for (const item of keys) {
            const key = item;
            if (!key.emailFrom) {
                continue;
            }
            if (emailHashs.includes(key.emailHash)) {
                emailInfos.push({ email: key.emailFrom, pepper: key.pepper });
            }
        }
        return emailInfos;
    }
    catch (error) {
        logger.error(`[getEmailRawDataByHashs] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
            keysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
const getAddGuardin = (updateKeys, oldKeys, logger) => {
    let index = 0;
    for (const item of updateKeys) {
        const key = item;
        let oldKey;
        try {
            oldKey = oldKeys[index];
        }
        catch (_a) {
            logger.warn(`[getAddGuardin] index = ${index} old key not find`);
        }
        if (oldKey && oldKey.emailHash === key.emailHash) {
            oldKey.roleWeight = item.roleWeight;
        }
        index++;
        if (key.type === 'Raw') {
            if (oldKey && oldKey.emailHash === key.emailHash) {
                continue;
            }
            oldKeys.push(key);
        }
    }
    return oldKeys;
};
const getRemoveGuardin = (updateKeys, oldKeys) => {
    const guardiansList = [];
    const oldGuardianMap = new Map();
    oldKeys.forEach((item) => {
        oldGuardianMap.set(item.emailHash, item);
    });
    for (const item of updateKeys) {
        const key = item;
        const guardianKey = oldGuardianMap.get(key.emailHash);
        if (guardianKey) {
            guardianKey.roleWeight = key.roleWeight;
            guardiansList.push(guardianKey);
        }
    }
    return guardiansList;
};
export function getUpdateGuardinKeyset(updateKeysetJson, oldKeysetJson, isAddGuradian, logger) {
    try {
        const updateKeyset = Keyset.fromJson(updateKeysetJson);
        const oldKeyset = Keyset.fromJson(oldKeysetJson);
        const policyKey = oldKeyset.keys[oldKeyset.keys.length - 1];
        const updateKeys = updateKeyset.keys.slice(2, -1);
        const oldKeys = oldKeyset.keys.slice(2, -1);
        const keys = [oldKeyset.keys[0], oldKeyset.keys[1]];
        let guardiansList = [];
        guardiansList = isAddGuradian
            ? getAddGuardin(updateKeys, oldKeys, logger)
            : getRemoveGuardin(updateKeys, oldKeys);
        const keysey = new Keyset([...keys, ...guardiansList, policyKey]);
        return keysey;
    }
    catch (error) {
        logger.error(`[getUpdateGuardinKeyset] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
            updateKeysetJson,
            oldKeysetJson,
        })}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
}
export function getUnipassWallet(masterWallet) {
    const masterKey = new KeySecp256k1Wallet(masterWallet, new RoleWeight(100, 100, 100), SignType.EthSign);
    const keyset = new Keyset([masterKey]);
    return keyset;
}
export function getUnipassWalletContext() {
    const isMainNet = process.env.IS_MAIN_NET === 'true';
    const unipassWalletContext = isMainNet
        ? MAINNET_UNIPASS_WALLET_CONTEXT
        : TESTNET_UNIPASS_WALLET_CONTEXT;
    return unipassWalletContext;
}
export async function getPolicySign(keysetJson, digestHash, logger) {
    let keyset;
    try {
        keyset = Keyset.fromJson(keysetJson);
    }
    catch (error) {
        logger.warn(`[getPolicySign] ${error}`);
        throw new BadRequestException(StatusName.KEYSET_ERROR);
    }
    const policyKey = keyset.keys[keyset.keys.length - 1];
    const policyKeyData = getPolicyData(policyKey.roleWeight, policyKey);
    logger.log(`[getPolicySign]policyKeyData= ${policyKeyData.toJson()}`);
    const sig = await policyKeyData.generateSignature(digestHash);
    return sig;
}
