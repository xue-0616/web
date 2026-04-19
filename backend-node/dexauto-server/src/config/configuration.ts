import { readFileSync } from 'fs';

export default () => {;
    const secretPath = process.env.SECRET_PATH;
    if (!secretPath) {
        throw new Error('expected secret path');
    }
    const secretConfig = JSON.parse(readFileSync(secretPath).toString());
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        logFormat: process.env.LOG_FORMAT || 'pretty',
        jwtSecret: secretConfig.jwtSecret ??
            (() => {
                throw new Error('expected jwtSecret');
            })(),
        tradingServerUrl: process.env.TRADING_SERVER_URL ??
            (() => {
                throw new Error('expected TRADING_SERVER_URL');
            })(),
        dataCenterWs: process.env.DATA_CENTER_WS ??
            (() => {
                throw new Error('expected DATA_CENTER_WS');
            })(),
        solanaRpcUrl: process.env.SOLANA_RPC_URL ??
            (() => {
                throw new Error('expected SOLANA_RPC_URL');
            })(),
        firebaseProjectId: secretConfig.firebase.projectId ??
            (() => {
                throw new Error('expected firebaseProjectId');
            })(),
        firebasePrivateKey: secretConfig.firebase.privateKey ??
            (() => {
                throw new Error('expected firebasePrivateKey');
            })(),
        firebaseClientEmail: secretConfig.firebase.clientEmail ??
            (() => {
                throw new Error('expected firebaseClientEmail');
            })(),
        // Yellowstone gRPC (optional — if not set, falls back to WebSocket data center)
        GEYSER_GRPC_ENDPOINT: process.env.GEYSER_GRPC_ENDPOINT || '',
        GEYSER_GRPC_TOKEN: process.env.GEYSER_GRPC_TOKEN || '',
        // AWS KMS (used for encrypting wallet private keys). Source from
        // secretConfig.kms.* first, fall back to env vars. For local dev
        // point `kmsRegion` at a region + stub the access keys; real KMS
        // calls only happen on wallet create/decrypt paths.
        kmsRegion: secretConfig.kms?.region ?? process.env.AWS_REGION ?? 'us-east-1',
        kmsAccessKeyId: secretConfig.kms?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? '',
        kmsSecretAccessKey: secretConfig.kms?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
        kmsKeyId: secretConfig.kms?.keyId ?? process.env.KMS_KEY_ID ?? '',
    };
}
