import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { LaunchpadTransactionService } from './launchpad.transaction.service';

@Injectable()
export class LaunchpadTaskService {
    constructor(private readonly logger: AppLoggerService, private readonly launchpadTransactionService: LaunchpadTransactionService) {
        this.logger.setContext(LaunchpadTaskService.name);
        this.queryInitMintTransactionTask();
    }
    async queryInitMintTransactionTask(): Promise<void> {
            try {
                await this.launchpadTransactionService.queryInitMintTransaction();
            }
            catch (error) {
                this.logger.error(`[queryInitMintTransaction] error: ${error?.stack}}`);
            }
        }
}
