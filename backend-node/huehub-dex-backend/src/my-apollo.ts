import { readFileSync as fsReadFileSync } from 'fs';
import { hostname as osHostname } from 'os';
import { remoteConfigServiceFromCache } from 'node-apollo';

const readFileSync = (filePath: string) => {
    const data = fsReadFileSync(filePath, 'utf8');
    return JSON.parse(data);
};
export async function initApolloConfig() {
    const { appId, configServerUrl, secretPatch, cluster, namespace } = process.env;
    const hostname = osHostname();
    const apolloEnv = {
        configServerUrl,
        appId,
        clusterName: cluster,
        namespaceName: namespace,
        clientIp: `${hostname}`,
    };
    try {
        const apolloConf = await remoteConfigServiceFromCache(apolloEnv);
        const secretConf = readFileSync(`${secretPatch}`);
        process.env = Object.assign(process.env, { ...apolloConf, ...secretConf });
    }
    catch (error) {
        console.error(`[initApolloConfig] ${error},apolloEnv = ${JSON.stringify(apolloEnv)}`);
    }
}
