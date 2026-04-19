import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { RemoteSocket } from 'socket.io';
import { In, Repository } from 'typeorm';
import SysRoleMenu from '../../entities/default/admin/sys-role-menu.entity';
import SysUserRole from '../../entities/default/admin/sys-user-role.entity';
import { AdminWSGateway } from '../../modules/ws/admin-ws.gateway';
import { EVENT_UPDATE_MENU } from './ws.event';

@Injectable()
export class AdminWSService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(SysRoleMenu, 'default')
    private readonly roleMenuRepository: Repository<SysRoleMenu>,
    @InjectRepository(SysUserRole, 'default')
    private readonly userRoleRepository: Repository<SysUserRole>,
    private readonly adminWsGateWay: AdminWSGateway,
  ) {}

  async getOnlineSockets(): Promise<RemoteSocket<any, any>[]> {
    return this.adminWsGateWay.socketServer.fetchSockets();
  }

  async findSocketIdByUid(uid: string | number): Promise<RemoteSocket<any, any> | undefined> {
    const onlineSockets = await this.getOnlineSockets();
    return onlineSockets.find((socket) => {
      const token = socket.handshake.query?.token;
      const normalizedToken = Array.isArray(token) ? token[0] : token;
      if (!normalizedToken) {
        return false;
      }

      try {
        return this.jwtService.verify(normalizedToken).uid === uid;
      } catch {
        return false;
      }
    });
  }

  async filterSocketIdByUidArr(uids: Array<string | number>): Promise<RemoteSocket<any, any>[]> {
    const onlineSockets = await this.getOnlineSockets();
    return onlineSockets.filter((socket) => {
      const token = socket.handshake.query?.token;
      const normalizedToken = Array.isArray(token) ? token[0] : token;
      if (!normalizedToken) {
        return false;
      }

      try {
        return uids.includes(this.jwtService.verify(normalizedToken).uid);
      } catch {
        return false;
      }
    });
  }

  async noticeUserToUpdateMenusByUserIds(uid: string | number | Array<string | number>): Promise<void> {
    const userIds = Array.isArray(uid) ? uid : [uid];
    const sockets = await this.filterSocketIdByUidArr(userIds);
    if (sockets.length > 0) {
      this.adminWsGateWay.socketServer
        .to(sockets.map((socket) => socket.id))
        .emit(EVENT_UPDATE_MENU);
    }
  }

  async noticeUserToUpdateMenusByMenuIds(menuIds: Array<string | number>): Promise<void> {
    const roleMenus = await this.roleMenuRepository.find({
      where: { menuId: In(menuIds as any[]) },
    });
    const roleIds = roleMenus.map((item) => item.roleId);
    await this.noticeUserToUpdateMenusByRoleIds(roleIds);
  }

  async noticeUserToUpdateMenusByRoleIds(roleIds: Array<string | number>): Promise<void> {
    const users = await this.userRoleRepository.find({
      where: { roleId: In(roleIds as any[]) },
    });
    if (users.length > 0) {
      const userIds = users.map((item) => item.userId);
      await this.noticeUserToUpdateMenusByUserIds(userIds);
    }
  }
}
