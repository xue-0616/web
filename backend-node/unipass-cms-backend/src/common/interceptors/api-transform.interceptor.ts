import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TRANSFORM_KEEP_KEY_METADATA } from '../contants/decorator.contants';
import { ResponseDto } from '../class/res.class';

@Injectable()
export class ApiTransformInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(map((data) => {
            const keep = this.reflector.get(TRANSFORM_KEEP_KEY_METADATA, context.getHandler());
            if (keep) {
                return data;
            } else {
                const response = context.switchToHttp().getResponse();
                response.header('Content-Type', 'application/json; charset=utf-8');
                return new ResponseDto(200, data);
            }
        }));
    }
}
