import { HttpException, HttpStatus } from '@nestjs/common';

export enum MyErrorCode {
  AddressNotQualified = 4001,
  AssetIsNotSupport = 4002,
  SequencerConnectionErr = 4003,
  TransactionValidationFailed = 4004,
  PoolLiquidityNotEnough = 4005,
  RateLimitExceeded = 4290,
  PaymasterOutOfService = 5003,
}

export class MyCustomException extends HttpException {
  constructor(msg: string, errCode: MyErrorCode) {
    super({ code: errCode, message: msg }, HttpStatus.FORBIDDEN);
  }
}
