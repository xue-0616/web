

export class Weight {
    getMasterKeyWeight() {
            return {
                ownerWeight: 60,
                guardianWeight: 0,
                assetsOpWeight: 100,
            };
        }
    getKMSMasterKeyWeight() {
            return {
                ownerWeight: 100,
                guardianWeight: 0,
                assetsOpWeight: 100,
            };
        }
    getPolicyWeight() {
            return {
                ownerWeight: 40,
                guardianWeight: 0,
                assetsOpWeight: 0,
            };
        }
    getRegisterEmailWeight() {
            return {
                ownerWeight: 60,
                guardianWeight: 60,
                assetsOpWeight: 0,
            };
        }
    getSelfGuardianlWeight() {
            return {
                ownerWeight: 50,
                guardianWeight: 50,
                assetsOpWeight: 0,
            };
        }
    getOneGuardianWeight() {
            return {
                ownerWeight: 0,
                guardianWeight: 50,
                assetsOpWeight: 0,
            };
        }
    getMoreGuardianWeight() {
            return {
                ownerWeight: 0,
                guardianWeight: 40,
                assetsOpWeight: 0,
            };
        }
}
