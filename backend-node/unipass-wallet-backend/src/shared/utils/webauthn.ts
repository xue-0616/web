import { v5 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { StatusName } from '.';
import { AuthStatus, AuthType } from '../../modules/account/entities';

export const getChallengeUuid = (name) => v5(name, v5.URL);
export function toBuffer(txt: string) {
    const buffer = Uint8Array.from(txt, (c: string) => c.charCodeAt(0)).buffer;
    const uint8Arraybuffer = new Uint8Array(buffer);
    return uint8Arraybuffer;
}
export function parseBuffer(buffer) {
    return String.fromCharCode(...new Uint8Array(buffer));
}
export function verifyReqRegistrationResponseJSON(webauthnData, challenge, deviceInfo) {
    const { rawId, response, clientExtensionResults, type, id } = webauthnData;
    if (!id || !rawId || !response || !clientExtensionResults || !type) {
        throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
    }
    const { clientDataJSON, attestationObject, transports } = response;
    if (!clientDataJSON || !attestationObject || !transports) {
        throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
    }
    if (!challenge || !deviceInfo) {
        throw new BadRequestException(StatusName.WEBAUTHN_ADD_TIMEOUT);
    }
}
export const comparisonKey = (credentialID, value) => {
    let keyInfo;
    const isMatch = false;
    try {
        keyInfo = JSON.parse(value);
    }
    catch (_a) {
        return isMatch;
    }
    if (!keyInfo) {
        return isMatch;
    }
    return keyInfo.credentialID === credentialID;
};
export const showWebAuthnList = (authList, isShowReCaptcha) => {
    const webAuthnList = [];
    let status = AuthStatus.Open;
    for (const item of authList) {
        let keyInfo;
        status = item.status;
        try {
            keyInfo = JSON.parse(JSON.stringify(item.value));
        }
        catch (_a) {
            continue;
        }
        webAuthnList.push({
            credentialID: keyInfo.credentialID,
            credentialPublicKey: keyInfo.credentialPublicKey,
            counter: keyInfo.counter,
            deviceInfo: keyInfo.deviceInfo,
            updateTime: keyInfo.updateTime,
        });
    }
    const authData = {
        type: AuthType.WebAuthn,
        value: webAuthnList,
        status,
        isShowReCaptcha,
    };
    return authData;
};
