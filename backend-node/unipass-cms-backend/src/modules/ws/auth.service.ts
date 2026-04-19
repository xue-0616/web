import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IAdminUser } from '../admin/admin.interface';
import { isEmpty } from 'lodash';
import { SocketException } from '../../common/exceptions/socket.exception';

@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService) {}

    checkAdminAuthToken(token: string | string[]): IAdminUser | never {
        if (isEmpty(token)) {
            throw new SocketException(11001);
        }
        try {
            return this.jwtService.verify(Array.isArray(token) ? token[0] : token);
        } catch (e) {
            throw new SocketException(11001);
        }
    }
}
