import { HttpException, HttpStatus } from '@nestjs/common';
import { buildErrorResponse } from './common/dto/response';

const UNKNOWN_ERROR = 1;
const BAD_REQUEST_CODE = 2;
const UNAUTHORIZED_CODE = 3;
export class BadRequestException extends HttpException {
    constructor(msg?: string) {
        super(buildErrorResponse(BAD_REQUEST_CODE, msg || 'bad request'), HttpStatus.OK);
    }
}
export class UnknownError extends HttpException {
    msg: any;
    constructor(msg: any) {
        super(buildErrorResponse(UNKNOWN_ERROR, 'unknown error'), HttpStatus.OK);
        this.msg = msg;
    }
}
export class UnauthorizedError extends HttpException {
    msg: any;
    constructor(msg: any) {
        super(buildErrorResponse(UNAUTHORIZED_CODE, 'unauthorized'), HttpStatus.OK);
        this.msg = msg;
    }
}
