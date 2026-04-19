import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LoginLogInfo, TaskLogInfo } from './log.class';
import SysLoginLog from '../../../../entities/default/admin/sys-login-log.entity';
import SysTaskLog from '../../../../entities/default/admin/sys-task-log.entity';
import SysUser from '../../../../entities/default/admin/sys-user.entity';
import { UtilService } from '../../../../shared/services/util.service';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class SysLogService {
    constructor(
        @InjectRepository(SysLoginLog, 'default')
        private readonly loginLogRepository: Repository<SysLoginLog>,
        @InjectRepository(SysTaskLog, 'default')
        private readonly taskLogRepository: Repository<SysTaskLog>,
        @InjectRepository(SysUser, 'default')
        private readonly userRepository: Repository<SysUser>,
        private readonly utilService: UtilService,
    ) {}

    async saveLoginLog(uid: number, ip: string, ua: string): Promise<void> {
        const loginLocation = await this.utilService.getLocation(ip.trim());
        await this.loginLogRepository.save({ ip, loginLocation, userId: uid, ua });
    }

    async countLoginLog(): Promise<number> {
        const userIds = await this.userRepository.createQueryBuilder('user').select(['user.id']).getMany();
        return this.loginLogRepository.count({ where: { userId: In(userIds.map((n) => n.id)) } });
    }

    async pageGetLoginLog(page: number, count: number): Promise<LoginLogInfo[]> {
        const result = await this.loginLogRepository.createQueryBuilder('login_log')
            .innerJoinAndSelect('sys_user', 'user', 'login_log.user_id = user.id')
            .orderBy('login_log.created_at', 'DESC')
            .offset(page * count)
            .limit(count)
            .getRawMany();
        const parser = new UAParser();
        return result.map((e: any) => {
            const u = parser.setUA(e.login_log_ua).getResult();
            return { id: e.login_log_id, ip: e.login_log_ip, os: `${u.os.name} ${u.os.version}`, browser: `${u.browser.name} ${u.browser.version}`, time: e.login_log_created_at, username: e.user_username, loginLocation: e.login_log_login_location };
        });
    }

    async clearLoginLog(): Promise<void> {
        await this.loginLogRepository.clear();
    }

    async recordTaskLog(tid: number, status: number, time: number, err: string): Promise<number> {
        const result = await this.taskLogRepository.save({ taskId: tid, status, detail: err } as any);
        return result.id;
    }

    async countTaskLog(): Promise<number> {
        return this.taskLogRepository.count();
    }

    async page(page: number, count: number): Promise<TaskLogInfo[]> {
        const result = await this.taskLogRepository.createQueryBuilder('task_log')
            .leftJoinAndSelect('sys_task', 'task', 'task_log.task_id = task.id')
            .orderBy('task_log.id', 'DESC')
            .offset(page * count)
            .limit(count)
            .getRawMany();
        return result.map((e: any) => ({ id: e.task_log_id, taskId: e.task_id, name: e.task_name, createdAt: e.task_log_created_at, consumeTime: e.task_log_consume_time, detail: e.task_log_detail, status: e.task_log_status }));
    }

    async clearTaskLog(): Promise<void> {
        await this.taskLogRepository.clear();
    }
}
