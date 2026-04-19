import { HttpException } from '@nestjs/common';
import { ErrorCodeMap, ErrorCodeMapType } from '../contants/error-code.contants';

export class ApiException extends HttpException {
    errorCode: ErrorCodeMapType;
    constructor(errorCode: ErrorCodeMapType) {
        super(ErrorCodeMap[errorCode], 200);
        this.errorCode = errorCode;
    }
    getErrorCode(): ErrorCodeMapType {
        return this.errorCode;
    }
}
