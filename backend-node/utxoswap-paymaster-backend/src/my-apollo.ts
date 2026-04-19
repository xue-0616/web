import { readFileSync as fsReadFileSync } from 'fs';
import { hostname as osHostname } from 'os';
import { config } from 'dotenv';

const readJsonFile = (filePath: string) => {
    const data = fsReadFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

export async function initApolloConfig() {
    const { appId, configServerUrl, secretPath, cluster, namespace } = process.env;
    const hostname = osHostname();
    const apolloEnv = {
        configServerUrl,
        appId,
        clusterName: cluster,
        namespaceName: namespace,
        clientIp: `${hostname}`,
    };
    try {
        console.log(`----------- Init Config with NODE_ENV = [${process.env.NODE_ENV}] -----------`);
        config({ path: `config/env.${process.env.NODE_ENV}` });
        const secretConf = readJsonFile(`${secretPath}`);
        process.env = Object.assign(process.env, { ...secretConf });
    }
    catch (error) {
        console.error(`[initApolloConfig] ${error}, apolloEnv = ${JSON.stringify(apolloEnv)}`);
    }
}
