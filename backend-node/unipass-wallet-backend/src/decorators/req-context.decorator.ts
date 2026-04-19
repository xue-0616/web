import { RequestContext } from '../interfaces';
import { createParamDecorator } from '@nestjs/common';

export const REQUEST_ID_TOKEN_HEADER = 'x-request-id';
export const FORWARDED_FOR_TOKEN_HEADER = 'x-forwarded-for';
export const VALIDATION_PIPE_OPTIONS = { transform: true, whitelist: true };
export function createRequestContext(request: any) {
    const ctx = new RequestContext();
    ctx.requestID = request.header(exports.REQUEST_ID_TOKEN_HEADER);
    ctx.url = request.url;
    ctx.ip = request.header(exports.FORWARDED_FOR_TOKEN_HEADER)
        ? request.header(exports.FORWARDED_FOR_TOKEN_HEADER)
        : request.ip;
    return ctx;
}
export const reqContext = createParamDecorator((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return createRequestContext(request);
});
export const ReqContext = createParamDecorator((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return createRequestContext(request);
});
