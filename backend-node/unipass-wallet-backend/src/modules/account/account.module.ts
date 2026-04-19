import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import * as services from './service';
import * as dbServices from './service/db';
import * as assetServices from './service/asset';
import * as txServices from './service/transaction';
import * as controllers from './controller';
import * as processors from './processor';
import * as entities from './entities';

import { ACCOUNT_QUEUE, TRANSACTION_QUEUE, SEND_EMAIL_QUEUE } from '../../shared/utils/bull.name';
import { sleep } from '../../shared/utils';

// --- Flatten namespace imports into arrays of concrete classes ---
// Nest DI needs class references, not the namespace objects themselves.
const collectClasses = (ns: Record<string, unknown>): any[] =>
    Object.values(ns).filter((v): v is any => typeof v === 'function');

const serviceProviders: any[] = [
    ...collectClasses(services),
    ...collectClasses(dbServices),
    ...collectClasses(assetServices),
    ...collectClasses(txServices),
];
const processorProviders: any[] = collectClasses(processors);
const controllersList: any[] = collectClasses(controllers);
const entityList: any[] = collectClasses(entities);

const importsNoQueue: any[] = [
    TypeOrmModule.forFeature(entityList as any),
];
const importsWithQueue: any[] = [
    TypeOrmModule.forFeature(entityList as any),
    BullModule.registerQueue(
        { name: ACCOUNT_QUEUE },
        { name: TRANSACTION_QUEUE },
        { name: SEND_EMAIL_QUEUE },
    ),
];

const providersNoQueue: any[] = [...serviceProviders];
const providersHaveQueue: any[] = [...serviceProviders, ...processorProviders];

@Module({
    imports: importsNoQueue,
    providers: providersNoQueue,
    exports: [...serviceProviders],
    controllers: controllersList,
})
export class AccountModule {
    /**
     * Original runtime-branched module loader: when `ALLOW_QUEUE=true`,
     * pull in Bull queues and processors; otherwise keep the module lean.
     */
    static async forRootAsync(): Promise<DynamicModule> {
        await sleep(1000);
        const isAllowQueue =
            (process.env.ALLOW_QUEUE || 'false').toLowerCase() === 'true';
        return {
            module: AccountModule,
            imports: isAllowQueue ? importsWithQueue : importsNoQueue,
            providers: isAllowQueue ? providersHaveQueue : providersNoQueue,
            exports: [...serviceProviders],
            controllers: controllersList,
        };
    }
}
