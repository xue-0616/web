import { ActionsJsonConfig } from './interface';

export class ActionsURLMapper {
    constructor(private config: ActionsJsonConfig) {
    }
    mapUrl(url: string | URL): string | null {
            const urlObj = typeof url === 'string' ? new URL(url) : url;
            const queryParams = urlObj.search;
            for (const action of this.config.rules) {
                if (this.isExactMatch(action.pathPattern, urlObj)) {
                    return `${action.apiPath}${queryParams}`;
                }
                const match = this.matchPattern(action.pathPattern, urlObj);
                if (match) {
                    return this.constructMappedUrl(action.apiPath, match, queryParams, urlObj.origin);
                }
            }
            return null;
        }
    isExactMatch(pattern: any, urlObj: any) {
            return pattern === `${urlObj.origin}${urlObj.pathname}`;
        }
    matchPattern(pattern: any, urlObj: any) {
            const fullPattern = new RegExp(`^${pattern.replace(/\*\*/g, '(.*)').replace(/\/(\*)/g, '/([^/]+)')}$`);
            const urlToMatch = pattern.startsWith('http')
                ? urlObj.toString()
                : urlObj.pathname;
            return urlToMatch.match(fullPattern);
        }
    constructMappedUrl(apiPath: any, match: any, queryParams: any, origin: any) {
            let mappedPath = apiPath;
            match.slice(1).forEach((group) => {
                mappedPath = mappedPath.replace(/\*+/, group);
            });
            if (apiPath.startsWith('http')) {
                const mappedUrl = new URL(mappedPath);
                return `${mappedUrl.origin}${mappedUrl.pathname}${queryParams}`;
            }
            return `${origin}${mappedPath}${queryParams}`;
        }
}
