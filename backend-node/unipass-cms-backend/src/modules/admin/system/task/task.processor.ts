import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { SysLogService } from '../log/log.service';
import { SysTaskService } from './task.service';
import { SYS_TASK_QUEUE_NAME } from '../../admin.constants';

@Processor(SYS_TASK_QUEUE_NAME)
export class SysTaskConsumer {
    constructor(
        private readonly taskService: SysTaskService,
        private readonly taskLogService: SysLogService,
    ) {}

    @Process()
    async handle(job: Job): Promise<void> {
        const startTime = Date.now();
        const { data } = job;
        try {
            await this.taskService.callService(data.service, data.args);
            const timing = Date.now() - startTime;
            await this.taskLogService.recordTaskLog(data.id, 1, timing, '');
        } catch (e) {
            const timing = Date.now() - startTime;
            await this.taskLogService.recordTaskLog(data.id, 0, timing, `${e}`);
        }
    }

    @Process('onCompleted')
    onCompleted(job: Job): void {
        this.taskService.updateTaskCompleteStatus(job.data.id);
    }
}
