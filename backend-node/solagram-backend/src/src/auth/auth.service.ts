import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppLoggerService } from '../common/utils-service/logger.service';
import { IJwt } from '../common/interface/jwt';

@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService, private readonly logger: AppLoggerService) {
        this.logger.setContext(AuthService.name);
    }
    generateJwt(payload: any): string {
            return this.jwtService.sign(payload);
        }
    verifyToken(token: string): IJwt {
            try {
                const data = this.jwtService.verify(token);
                return data;
            }
            catch (error) {
                this.logger.error(`[verifyToken] error ${error?.stack}`);
                return undefined;
            }
        }
}
