import { ActionGetResponse, ActionPostRequest, ActionPostResponse, ActionsJson, parseURL } from '@solana/actions';
import { IBlinkActionInfo } from '../interface/blink-actions';
import { AppLoggerService } from '../utils-service/logger.service';

export class StructureValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StructureValidationError';
    }
    name: any;
}

export class ActionsURLMapper {
    constructor(private config: ActionsJson) {
    }
    mapUrl(url: string | URL): string | null {
            const urlObj = typeof url === 'string' ? new URL(url) : url;
            const queryParams = urlObj.search;
            if (!this.config.rules) {
                return null;
            }
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
            match.slice(1).forEach((group: string) => {
                mappedPath = mappedPath.replace(/\*+/, group);
            });
            if (apiPath.startsWith('http')) {
                const mappedUrl = new URL(mappedPath);
                return `${mappedUrl.origin}${mappedUrl.pathname}${queryParams}`;
            }
            return `${origin}${mappedPath}${queryParams}`;
        }
}

export function validateStructure(reference: any, target: any): any {
    if (typeof target === 'string') {
        try {
            target = JSON.parse(target);
        }
        catch (error) {
            throw new StructureValidationError('Target is not valid JSON');
        }
    }
    if (typeof target == 'string') {
        throw new StructureValidationError('Target is not valid JSON');
    }
    if (Array.isArray(reference)) {
        if (!Array.isArray(target)) {
            throw new StructureValidationError('Target must be an array');
        }
        if (reference.length !== 1) {
            throw new StructureValidationError('Array reference must have exactly one element');
        }
        const referenceItem = reference[0];
        const validatedArray = [];
        for (const item of target) {
            validatedArray.push(validateStructure(referenceItem, item));
        }
        return validatedArray;
    }
    if (typeof reference !== 'object' ||
        (reference === null &&
            reference?.required == true)) {
        throw new StructureValidationError('Reference must be a non-null object or array');
    }
    if (typeof target !== 'object' || target === null) {
        throw new StructureValidationError('Target must be a non-null object or array');
    }
    for (const key in reference) {
        const referenceProperty = reference[key];
        if (!target.hasOwnProperty(key)) {
            if (referenceProperty.required) {
                throw new StructureValidationError(`Missing key '${key}' in target object`);
            }
            continue;
        }
        if (!referenceProperty.required && !target[key])
            continue;
        const referenceType = referenceProperty.type;
        const targetType = Array.isArray(target[key])
            ? 'array'
            : typeof target[key];
        if (referenceType === 'object') {
            if (Array.isArray(referenceProperty.children) &&
                Array.isArray(target[key])) {
                continue;
            }
            else if (!validateStructure(referenceProperty.children, target[key])) {
                throw new StructureValidationError(`Structure mismatch at key '${key}'`);
            }
        }
        else if (referenceType !== targetType) {
            throw new StructureValidationError(`Type mismatch at key '${key}'. Expected '${referenceType}', got '${targetType}'`);
        }
    }
    return target;
}

export async function fetchActionsJson(url: URL): Promise<ActionsJson> {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
        redirect: 'manual',
    });
    if (res.ok) {
        const actionsString = await res.text();
        const actionsJson = validateStructure(exports.STRUCT_ACTIONS_JSON, actionsString);
        return actionsJson;
    }
    throw Error(`url is ${url.href}, Failed fetch Actions.json`);
}

export async function fetchActionsGet(url: URL): Promise<ActionGetResponse> {
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
        redirect: 'manual',
    });
    if (res.ok) {
        const actionsGetString = await res.text();
        const actionsGetJson = validateStructure(exports.STRUCT_ACTIONS_GET_RESPONSE, actionsGetString);
        return actionsGetJson;
    }
    throw Error(`Failed fetch Actions Get ${url}`);
}

export async function fetchActionsPost(url: URL, body: ActionPostRequest): Promise<ActionPostResponse> {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (res.ok) {
        const actionsPostString = await res.text();
        const actionsPostJson = validateStructure(exports.STRUCT_ACTIONS_POST_RESPONSE, actionsPostString);
        return actionsPostJson;
    }
    throw Error('Failed fetch Actions Get');
}

export function linkedActionHref(href: string, getEndpointUrl: URL): string {
    return new URL(href, href.startsWith('/') ? getEndpointUrl.origin : undefined).toString();
}

export async function detectSolanaAction(url: string, logger: AppLoggerService): Promise<IBlinkActionInfo | undefined> {
    let actionUrl;
    let searchParams = null;
    let parsedUrl = null;
    let domain = null;
    try {
        parsedUrl = parseURL(url) as any;
        if (!!parsedUrl?.blink) {
            searchParams = (parsedUrl.blink.searchParams
                .get('action') ?? '')
                .replace('solana-action:', '');
            actionUrl = parsedUrl.action.link;
        }
        if (!!parsedUrl?.link) {
            actionUrl = parsedUrl.link;
        }
    }
    catch (e) {
        actionUrl = new URL(url);
        domain = actionUrl.host;
    }
    logger.log(`[detectSolanaAction] parsedUrl =${JSON.stringify(parsedUrl)},searchParams = ${searchParams}`);
    try {
        let actionsJson = null;
        let actionsGet = null;
        try {
            actionsJson = await fetchActionsJson(new URL('actions.json', (actionUrl as URL).origin));
            const actionsURLMapper = new ActionsURLMapper(actionsJson);
            let mappedUrl = new URL(actionsURLMapper.mapUrl(actionUrl as URL) as string);
            actionsGet = await fetchActionsGet(mappedUrl);
            domain = mappedUrl.host;
        }
        catch (error) {
            const e = error as Error;
            logger.log(`[detectSolanaAction] fetchActionsJson ${(actionUrl as URL)?.origin} actions.json  error =  ${e.message} `);
        }
        if (!actionsGet && searchParams) {
            actionsGet = await fetchActionsGet(new URL(`https://proxy.dial.to/?url=${encodeURIComponent(searchParams)}`));
            domain = new URL(searchParams).host;
        }
        logger.log(`[detectSolanaAction] actionsGet =${JSON.stringify(actionsGet)} `);
        if (!actionsGet || !domain) {
            return undefined;
        }
        return { actionsGet, url, domain };
    }
    catch (e) {
        logger.error(`[detectSolanaAction] ${(e as Error)?.stack} URL is ${url}`);
        return undefined;
    }
}

export const STRUCT_ACTIONS_JSON = {
    rules: {
        type: 'array',
        required: false,
    },
};

export const STRUCT_ACTIONS_GET_RESPONSE = {
    title: {
        type: 'string',
        required: true,
    },
    icon: {
        type: 'string',
        required: true,
    },
    label: {
        type: 'string',
        required: false,
    },
    description: {
        type: 'string',
        required: true,
    },
    disabled: {
        type: 'boolean',
        required: false,
    },
    error: {
        type: 'object',
        required: false,
    },
    links: {
        type: 'object',
        required: false,
        children: {
            actions: {
                type: 'array',
                required: true,
            },
        },
    },
};

export const STRUCT_ACTIONS_POST_RESPONSE = {
    transaction: {
        type: 'string',
        required: true,
    },
    message: {
        type: 'string',
        required: false,
    },
};
