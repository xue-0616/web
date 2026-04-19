import { Controller } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { TasksService } from './tasks.service';

@Controller('fix')
export class FixController {
    constructor(private readonly logger: AppLoggerService, private readonly tasksService: TasksService) {
        this.logger.setContext(FixController.name);
    }
}
