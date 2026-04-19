import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Queue } from 'bull';
import { LoggerService } from '../../../../shared/logger/logger.service';
import { RedisService } from '../../../../shared/services/redis.service';
import { Repository } from 'typeorm';
import { CreateTaskDto, UpdateTaskDto } from './task.dto';
import SysTask from '../../../../entities/default/admin/sys-task.entity';
import { InjectQueue } from '@nestjs/bull';
import { UnknownElementException } from '@nestjs/core/errors/exceptions/unknown-element.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { isEmpty } from 'lodash';
import { MISSION_KEY_METADATA } from '../../../../common/contants/decorator.contants';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { SYS_TASK_QUEUE_NAME, SYS_TASK_QUEUE_PREFIX } from '../../admin.constants';

@Injectable()
export class SysTaskService implements OnModuleInit {
    constructor(
        @InjectRepository(SysTask, 'default')
        private readonly taskRepository: Repository<SysTask>,
        @InjectQueue(SYS_TASK_QUEUE_NAME)
        private readonly taskQueue: Queue,
        private readonly moduleRef: ModuleRef,
        private readonly reflector: Reflector,
        private readonly redisService: RedisService,
        private readonly logger: LoggerService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.initTask();
    }

    async initTask(): Promise<void> {
        const initKey = `${SYS_TASK_QUEUE_PREFIX}:init`;
        const result = await this.redisService.getRedis().multi().setnx(initKey, new Date().getTime()).expire(initKey, 60 * 30).exec();
        if ((result as any)[0][1] === 0) {
            this.logger.log('Init task is lock', SysTaskService.name);
            return;
        }
        const jobs = await this.taskQueue.getJobs(['active', 'delayed', 'failed', 'paused', 'waiting', 'completed']);
        for (let i = 0; i < jobs.length; i++) {
            await jobs[i].remove();
        }
        const tasks = await this.taskRepository.find({ where: { status: 1 } });
        if (tasks && tasks.length > 0) {
            for (const t of tasks) {
                await this.start(t);
            }
        }
        await this.redisService.getRedis().del(initKey);
    }

    async page(page: number, count: number): Promise<SysTask[]> {
        return this.taskRepository.find({ order: { id: 'ASC' }, take: count, skip: page * count });
    }

    async count(): Promise<number> {
        return this.taskRepository.count();
    }

    async info(id: number): Promise<SysTask> {
        return this.taskRepository.findOne({ where: { id } }) as Promise<SysTask>;
    }

    async delete(task: SysTask): Promise<void> {
        if (!task) throw new Error('Task is Empty');
        await this.stop(task);
        await this.taskRepository.delete(task.id);
    }

    async once(task: SysTask): Promise<void> {
        if (task) {
            await this.taskQueue.add({ id: task.id, service: task.service, args: task.data }, { jobId: task.id, removeOnComplete: true, removeOnFail: true });
        } else {
            throw new Error('Task is Empty');
        }
    }

    async addOrUpdate(param: CreateTaskDto | UpdateTaskDto): Promise<void> {
        const result = await this.taskRepository.save(param as any);
        const task = await this.info(result.id);
        if ((result as any).status === 0) {
            await this.stop(task);
        } else if ((result as any).status === 1) {
            await this.start(task);
        }
    }

    async start(task: SysTask): Promise<void> {
        if (!task) throw new Error('Task is Empty');
        await this.stop(task);
        let repeat: any;
        if ((task as any).type === 1) {
            repeat = { every: (task as any).every };
        } else {
            repeat = { cron: (task as any).cron };
            if ((task as any).startTime) repeat.startDate = (task as any).startTime;
            if ((task as any).endTime) repeat.endDate = (task as any).endTime;
        }
        if ((task as any).limit > 0) repeat.limit = (task as any).limit;
        const job = await this.taskQueue.add({ id: task.id, service: (task as any).service, args: (task as any).data }, { jobId: task.id, removeOnComplete: true, removeOnFail: true, repeat });
        if (job && job.opts) {
            await this.taskRepository.update(task.id, { jobOpts: JSON.stringify(job.opts.repeat), status: 1 } as any);
        } else {
            job && (await job.remove());
            await this.taskRepository.update(task.id, { status: 0 } as any);
            throw new Error('Task Start failed');
        }
    }

    async stop(task: SysTask): Promise<void> {
        if (!task) throw new Error('Task is Empty');
        const exist = await this.existJob(task.id.toString());
        if (!exist) {
            await this.taskRepository.update(task.id, { status: 0 } as any);
            return;
        }
        const jobs = await this.taskQueue.getJobs(['active', 'delayed', 'failed', 'paused', 'waiting', 'completed']);
        for (let i = 0; i < jobs.length; i++) {
            if (jobs[i].data.id === task.id) await jobs[i].remove();
        }
        await this.taskRepository.update(task.id, { status: 0 } as any);
    }

    async existJob(jobId: string): Promise<boolean> {
        const jobs = await this.taskQueue.getRepeatableJobs();
        return jobs.map((e) => e.id).includes(jobId);
    }

    async updateTaskCompleteStatus(tid: number): Promise<void> {
        const jobs = await this.taskQueue.getRepeatableJobs();
        const task = await this.taskRepository.findOne({ where: { id: tid } });
        if (!task) return;
        for (const job of jobs) {
            if (job.id === tid.toString() && job.next < new Date().getTime()) {
                await this.stop(task);
                break;
            }
        }
    }

    async checkHasMissionMeta(nameOrInstance: any, exec: string): Promise<void> {
        try {
            let service;
            if (typeof nameOrInstance === 'string') {
                service = await this.moduleRef.get(nameOrInstance, { strict: false });
            } else {
                service = nameOrInstance;
            }
            if (!service || !(exec in service)) throw new ApiException(10102);
            const hasMission = this.reflector.get(MISSION_KEY_METADATA, service.constructor);
            if (!hasMission) throw new ApiException(10101);
        } catch (e) {
            if (e instanceof UnknownElementException) throw new ApiException(10102);
            else throw e;
        }
    }

    async callService(serviceName: string, args: string): Promise<void> {
        if (serviceName) {
            const arr = serviceName.split('.');
            if (arr.length < 1) throw new Error('serviceName define error');
            const methodName = arr[1];
            const service = await this.moduleRef.get(arr[0], { strict: false });
            await this.checkHasMissionMeta(service, methodName);
            if (isEmpty(args)) {
                await service[methodName]();
            } else {
                const parseArgs = this.safeParse(args);
                if (Array.isArray(parseArgs)) await service[methodName](...parseArgs);
                else await service[methodName](parseArgs);
            }
        }
    }

    safeParse(args: string): unknown {
        try { return JSON.parse(args); } catch { return args; }
    }
}
