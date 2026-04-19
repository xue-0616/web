import { RequestContext } from '../interfaces';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const REQUEST_ID_TOKEN_HEADER = 'x-request-id';
export const FORWARDED_FOR_TOKEN_HEADER = 'x-forwarded-for';
export const VALIDATION_PIPE_OPTIONS = { transform: true, whitelist: true };
export function createRequestContext(request: Request): RequestContext {
    const ctx = new RequestContext();
    ctx.requestID = request.header(REQUEST_ID_TOKEN_HEADER) as string;
    ctx.url = request.url;
    ctx.ip = (request.header(FORWARDED_FOR_TOKEN_HEADER)
        ? request.header(FORWARDED_FOR_TOKEN_HEADER)
        : request.ip) as string;
    return ctx;
}
export const reqContext = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return createRequestContext(request);
});
export const ReqContext = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return createRequestContext(request);
});
