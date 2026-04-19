import { readFileSync as fsReadFileSync } from 'fs';
import { config } from 'dotenv';

const readFileSync = (filePath: string) => {
    const data = fsReadFileSync(filePath, 'utf8');
    return JSON.parse(data);
};
export async function initConfig() {
    const { secretPath } = process.env;
    try {
        console.log(`----------- Init Config with NODE_ENV = [${process.env.NODE_ENV}] -----------`);
        config({ path: `./config/.${process.env.NODE_ENV}.env` });
        const secretConf = readFileSync(`${secretPath}`);
        process.env = Object.assign(process.env, { ...secretConf });
    }
    catch (error) {
        console.error(`[initSecretConfig] ${error}}`);
    }
}
