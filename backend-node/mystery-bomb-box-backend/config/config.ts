import * as fs from 'fs';
import * as dotenv from 'dotenv';

const readFileSync = (filePath: string) => {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}
export async function initConfig() {
  const { secretPath } = process.env;
  try {
    console.log(
      `----------- Init Config with NODE_ENV = [${process.env.NODE_ENV}] -----------`,
    );
    dotenv.config({ path: `./config/.${process.env.NODE_ENV}.env` });
    const secretConf = readFileSync(`${secretPath}`);
    process.env = Object.assign(process.env, { ...secretConf });
  } catch (error) {
    console.error(`[initSecretConfig] ${error}}`);
  }
}
