import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    private jwtService: JwtService;

    constructor(jwtService: JwtService) {
        this.jwtService = jwtService;
    }
    async generateJwt(userId: string): Promise<string> {
        const payload = { sub: userId };
        return this.jwtService.sign(payload);
    }
}
