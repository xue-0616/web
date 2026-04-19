// Recovered from dist/oauth2.interface.js.map (source: ../../../../src/modules/oauth2/interface/oauth2.interface.ts)

export interface IOAuth2Client {
    clientId: string;
    clientSecret: string;
    scope?: string;
    webServerRedirectUri?: string;
    accessTokenValidity?: number;
}
