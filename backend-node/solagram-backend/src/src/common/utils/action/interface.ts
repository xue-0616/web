type Action = {
    pathPattern: string;
    apiPath: string;
};
export type ActionsJsonConfig = {
    rules: Action[];
};
export const SOLANA_ACTION_PREFIX = /^(solana-action:|solana:)/;
