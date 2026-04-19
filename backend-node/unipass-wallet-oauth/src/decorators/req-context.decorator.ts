import { RequestContext } from '../interfaces';
import { createParamDecorator } from '@nestjs/common';

// Recovered from dist/req-context.decorator.js.map (source: ../../src/decorators/req-context.decorator.ts)

export const REQUEST_ID_TOKEN_HEADER = 'x-request-id';
export const FORWARDED_FOR_TOKEN_HEADER = 'x-forwarded-for';
export const VALIDATION_PIPE_OPTIONS = { transform: true, whitelist: true };
function createRequestContext(request: any): RequestContext {
    const ctx = new RequestContext();
    ctx.requestID = request.header(REQUEST_ID_TOKEN_HEADER);
    ctx.url = request.url;
    ctx.ip = request.header(FORWARDED_FOR_TOKEN_HEADER)
        ? request.header(FORWARDED_FOR_TOKEN_HEADER)
        : request.ip;
    return ctx;
}

export const reqContext = createParamDecorator((data: unknown, ctx: any) => {
    const request = ctx.switchToHttp().getRequest();
    return createRequestContext(request);
});
export const ReqContext = createParamDecorator((data: unknown, ctx: any) => {
    const request = ctx.switchToHttp().getRequest();
    return createRequestContext(request);
});
