import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { LoginService } from '../../../../modules/admin/login/login.service';
import { isEmpty } from 'lodash';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { ADMIN_PREFIX, ADMIN_USER, AUTHORIZE_KEY_METADATA, PERMISSION_OPTIONAL_KEY_METADATA } from '../../../../modules/admin/admin.constants';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwtService: JwtService,
        private readonly loginService: LoginService,
    ) {}
    async canActivate(context: any): Promise<boolean> {
        const authorize = this.reflector.get(AUTHORIZE_KEY_METADATA, context.getHandler());
        if (authorize) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const url = request.url;
        const path = url.split('?')[0];
        const token = request.headers['authorization'];
        if (isEmpty(token)) {
            throw new ApiException(11001);
        }
        try {
            request[ADMIN_USER] = this.jwtService.verify(token);
        }
        catch (e) {
            throw new ApiException(11001);
        }
        if (isEmpty(request[ADMIN_USER])) {
            throw new ApiException(11001);
        }
        const pv = await this.loginService.getRedisPasswordVersionById(request[ADMIN_USER].uid);
        if (pv !== `${request[ADMIN_USER].pv}`) {
            throw new ApiException(11002);
        }
        const redisToken = await this.loginService.getRedisTokenById(request[ADMIN_USER].uid);
        if (token !== redisToken) {
            throw new ApiException(11002);
        }
        const notNeedPerm = this.reflector.get(PERMISSION_OPTIONAL_KEY_METADATA, context.getHandler());
        if (notNeedPerm) {
            return true;
        }
        const perms = await this.loginService.getRedisPermsById(request[ADMIN_USER].uid);
        if (!perms || isEmpty(perms)) {
            throw new ApiException(11001);
        }
        const permArray = JSON.parse(perms).map((e: any) => {
            return e.replace(/:/g, '/').trim();
        });
        if (!permArray.includes(path.replace(`/${ADMIN_PREFIX}/`, ''))) {
            console.error({ permArray, path });
            throw new ApiException(11003);
        }
        else {
            return true;
        }
    }
}
