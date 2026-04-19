import { Injectable } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
    private logger: PinoLogger;
    private dataSource: DataSource;

    constructor(
        @InjectPinoLogger(AppService.name) logger: PinoLogger,
        dataSource: DataSource,
    ) {
        this.logger = logger;
        this.dataSource = dataSource;
    }
    getHello(): string {
        this.logger.info('Logged from getHello');
        return 'Hello World!';
    }
}
