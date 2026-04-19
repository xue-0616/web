const accessTokenList = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLndhbGxldC51bmlwYXNzLmlkLyJ9.._cfSmDag5WOmR5qx.YfTzHu3qbdzibCmAFadJC5VFce7ON3vkfvu5Bpb3HN_NTFRyuEyOTTTxEVMkGLFSLhSMgaM5Xfb_4C730Kvuaz5EgmLApFLTPmAUpaFnZagQVj6LoIz-RVfebTshKEbCMs5i63shpQZLIFODmcMazJRlTrMIPmQ1HE856xYvt894U8mEJSHuMtvvUdU7oxYMuGTBxqYiJj8MWCCyE1E8lL59MY9GYQjdhjfkro5hBgRqzck3Ul2YewJtSUB7KPz1UA9E9OLIqphooqb8oWeBmdv9B43w3HzKJosgpAsDoedZCJojrcGI8D6Re6it58i5eViG5MgO9g.9Rbi_L__IyoRwaQZarPLeA';
const whitelistEmail = 'unipass-whitelist@lay2.dev';
export const getUniPassWhiteListAccount = async (accressToken: any, accountsDBService: any) => {
    if (accessTokenList === accressToken) {
        const account = await accountsDBService.findOneInfo(whitelistEmail, 1);
        if (account) {
            return {
                email: account.email,
                sub: account.sub,
            };
        }
    }
};
