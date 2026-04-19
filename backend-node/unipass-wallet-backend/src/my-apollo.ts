import Fs from 'fs';
import Os from 'os';
import { remoteConfigServiceFromCache } from 'node-apollo';

const readFileSync = (filePath: any) => {
    const data = Fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};
export async function initApolloConfig() {
    const { APP_ID, CONFIG_SERVER_URL, SECRET_PATH, CLUSTER, NAMESPACE } = process.env;
    const hostname = Os.hostname();
    const apolloEnv = {
        configServerUrl: `${CONFIG_SERVER_URL}`,
        appId: `${APP_ID}`,
        clusterName: `${CLUSTER}`,
        namespaceName: [`${NAMESPACE}`],
        clientIp: `${hostname}`,
    };
    try {
        const apolloConf = await remoteConfigServiceFromCache(apolloEnv);
        const secretConf = readFileSync(`${SECRET_PATH}`);
        process.env = Object.assign(process.env, Object.assign(Object.assign({}, apolloConf), secretConf));
    }
    catch (error) {
        console.error(`[initApolloConfig] ${error},apolloEnv = ${JSON.stringify(apolloEnv)}`);
    }
}
