import { IBlinkActionInfo } from '../../interface/blink-actions';
import { SOLANA_ACTION_PREFIX } from './interface';
import { isInterstitial } from './interstitial-url';
import { ActionsURLMapper } from './url-mapper';

let proxyUrl = 'https://proxy.dial.to';
export async function fetchAction(apiUrl) {
    try {
        const url = await unfurlUrlToActionApiUrl(apiUrl);
        return await _fetch(url);
    }
    catch (error) {
        return null;
    }
}
function shouldIgnoreProxy(url) {
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
    }
    if (!proxyUrl) {
        return true;
    }
    return false;
}
export function proxify(url) {
    const baseUrl = new URL(url);
    if (shouldIgnoreProxy(baseUrl)) {
        return baseUrl;
    }
    const proxifiedUrl = new URL(proxyUrl);
    proxifiedUrl.searchParams.set('url', url);
    return proxifiedUrl;
}
async function _fetch(apiUrl) {
    const proxyUrl = proxify(apiUrl);
    const response = await fetch(proxyUrl, {
        headers: {
            Accept: 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch action ${proxyUrl}, action url: ${apiUrl}`);
    }
    const actionsGet = (await response.json());
    const url = new URL(apiUrl);
    return { actionsGet, url: url.href, domain: url.host };
}
export async function unfurlUrlToActionApiUrl(actionUrl) {
    const url = new URL(actionUrl);
    const strUrl = actionUrl.toString();
    if (SOLANA_ACTION_PREFIX.test(strUrl)) {
        return strUrl.replace(SOLANA_ACTION_PREFIX, '');
    }
    const interstitialData = isInterstitial(url);
    if (interstitialData.isInterstitial) {
        return interstitialData.decodedActionUrl;
    }
    const actionsJsonUrl = url.origin + '/actions.json';
    const actionsJson = await fetch(proxify(actionsJsonUrl)).then((res) => res.json());
    const actionsUrlMapper = new ActionsURLMapper(actionsJson);
    return actionsUrlMapper.mapUrl(url) || url.href;
}
