// Recovered from dist/transform.interceptor.js.map (source: ../../src/interceptors/transform.interceptor.ts)

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AppLoggerService } from '../shared/services';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLoggerService) {
        this.logger.setContext(TransformInterceptor.name);
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map((data: any) => {
                return data;
            }),
        );
    }
}
