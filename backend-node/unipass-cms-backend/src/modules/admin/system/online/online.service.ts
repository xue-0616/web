import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminWSService } from '../../../../modules/ws/admin-ws.service';
import { AdminWSGateway } from '../../../../modules/ws/admin-ws.gateway';
import { EntityManager } from 'typeorm';
import { SysUserService } from '../user/user.service';
import { OnlineUserInfo } from './online.class';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { EVENT_KICK } from '../../../../modules/ws/ws.event';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class SysOnlineService {
    constructor(
        @InjectEntityManager() private readonly entityManager: EntityManager,
        private readonly userService: SysUserService,
        private readonly adminWsGateWay: AdminWSGateway,
        private readonly adminWSService: AdminWSService,
        private readonly jwtService: JwtService,
    ) {}
    async listOnlineUser(currentUid: any): Promise<OnlineUserInfo[]> {
        const onlineSockets = await this.adminWSService.getOnlineSockets();
        if (!onlineSockets || onlineSockets.length <= 0) {
            return [];
        }
        const onlineIds = onlineSockets.map((socket) => {
            const token = socket.handshake.query?.token;
            const authToken = Array.isArray(token) ? token[0] : token;
            return this.jwtService.verify(authToken as string).uid;
        });
        return await this.findLastLoginInfoList(onlineIds, currentUid);
    }
    async kickUser(uid: any, currentUid: any): Promise<void> {
        const rootUserId = await this.userService.findRootUserId();
        const currentUserInfo = await this.userService.getAccountInfo(currentUid, '');
        if (uid === rootUserId) {
            throw new ApiException(10013);
        }
        await this.userService.forbidden(uid);
        const socket = await this.adminWSService.findSocketIdByUid(uid);
        if (socket) {
            this.adminWsGateWay.socketServer
                .to(socket.id)
                .emit(EVENT_KICK, { operater: currentUserInfo.name });
            socket.disconnect();
        }
    }
    async findLastLoginInfoList(ids: any, currentUid: any): Promise<OnlineUserInfo[]> {
        const rootUserId = await this.userService.findRootUserId();
        const result = await this.entityManager.query(`
      SELECT sys_login_log.created_at, sys_login_log.ip, sys_login_log.ua, sys_user.id, sys_user.username, sys_user.name
        FROM sys_login_log 
        INNER JOIN sys_user ON sys_login_log.user_id = sys_user.id 
        WHERE sys_login_log.created_at IN (SELECT MAX(created_at) as createdAt FROM sys_login_log GROUP BY user_id)
          AND sys_user.id IN (?)
      `, [ids]);
        if (result) {
            const parser = new UAParser();
            return result.map((e: any) => {
                const u = parser.setUA(e.ua).getResult();
                return {
                    id: e.id,
                    ip: e.ip,
                    username: `${e.name}（${e.username}）`,
                    isCurrent: currentUid === e.id,
                    time: e.created_at,
                    os: `${u.os.name} ${u.os.version}`,
                    browser: `${u.browser.name} ${u.browser.version}`,
                    disable: currentUid === e.id || e.id === rootUserId,
                };
            });
        }
        return [];
    }
}
