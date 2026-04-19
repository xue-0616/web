import { Weight } from './weight';
import { KeyEmailDkim, KeySecp256k1, Keyset, RoleWeight, SignType } from '@unipasswallet/keys';

export function getAccountKeysetJson(guardians: Array<{ email: string; isSelfGuardian?: boolean }>, email: string, openIDOptionsOrOpenIDHash: any, masterKeyAddress: string, policyAddress: string, pepper: string): string {
    const weight = new Weight();
    const masterWeight = weight.getMasterKeyWeight();
    const policyWeight = weight.getPolicyWeight();
    const masterKeyData = new KeySecp256k1(masterKeyAddress, new RoleWeight(masterWeight.ownerWeight, masterWeight.assetsOpWeight, masterWeight.guardianWeight), SignType.EthSign, async () => Promise.resolve(''));
    const policyData = new KeySecp256k1(policyAddress, new RoleWeight(policyWeight.ownerWeight, policyWeight.assetsOpWeight, policyWeight.guardianWeight), SignType.EthSign, async () => Promise.resolve(''));
    const guardiansList: InstanceType<typeof KeyEmailDkim>[] = [];
    for (const item of guardians) {
        let emailRoleWeight = guardians.length < 2
            ? weight.getOneGuardianWeight()
            : weight.getMoreGuardianWeight();
        if (item.isSelfGuardian === true) {
            emailRoleWeight = weight.getSelfGuardianlWeight();
        }
        const keyBase = new KeyEmailDkim('Raw', item.email, pepper, new RoleWeight(emailRoleWeight.ownerWeight, emailRoleWeight.assetsOpWeight, emailRoleWeight.guardianWeight));
        guardiansList.push(keyBase);
    }
    const getRegisterWeight = weight.getRegisterEmailWeight();
    const keysetData = Keyset.create(email, pepper, openIDOptionsOrOpenIDHash, masterKeyData, guardiansList, policyData, new RoleWeight(getRegisterWeight.ownerWeight, getRegisterWeight.assetsOpWeight, getRegisterWeight.guardianWeight));
    return keysetData.toJson();
}
export function getAccountKMSKeysetJson(masterKeyAddress: string): string {
    const weight = new Weight();
    const masterWeight = weight.getKMSMasterKeyWeight();
    const masterKeyData = new KeySecp256k1(masterKeyAddress, new RoleWeight(masterWeight.ownerWeight, masterWeight.assetsOpWeight, masterWeight.guardianWeight), SignType.EthSign, async () => Promise.resolve(''));
    const keysetData = new Keyset([masterKeyData]);
    return keysetData.toJson();
}
export function buildSignKeyset(keysetJson: string, signature: string): InstanceType<typeof Keyset> {
    const keyset = Keyset.fromJson(keysetJson);
    const signFunc = (_digestHash: any, _signType: any) => Promise.resolve(signature);
    const masterKey = keyset.keys[0];
    masterKey.signFunc = signFunc;
    keyset.keys[0] = masterKey;
    return keyset;
}
