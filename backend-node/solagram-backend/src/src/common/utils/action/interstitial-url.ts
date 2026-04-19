import { SOLANA_ACTION_PREFIX } from './interface';

export function isInterstitial(url) {
    try {
        const urlObj = new URL(url);
        const actionUrl = urlObj.searchParams.get('action');
        if (!actionUrl) {
            return { isInterstitial: false };
        }
        const urlDecodedActionUrl = decodeURIComponent(actionUrl);
        if (!SOLANA_ACTION_PREFIX.test(urlDecodedActionUrl)) {
            return { isInterstitial: false };
        }
        const decodedActionUrl = urlDecodedActionUrl.replace(SOLANA_ACTION_PREFIX, '');
        const decodedActionUrlObj = new URL(decodedActionUrl);
        return {
            isInterstitial: true,
            decodedActionUrl: decodedActionUrlObj.toString(),
        };
    }
    catch (e) {
        console.error(`[@dialectlabs/blinks] Failed to check if URL is interstitial: ${url}`, e);
        return { isInterstitial: false };
    }
}
