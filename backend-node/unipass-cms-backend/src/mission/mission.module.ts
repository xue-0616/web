import { DynamicModule, Module } from '@nestjs/common';
import { AdminModule } from '../modules/admin/admin.module';
import { SysLogService } from '../modules/admin/system/log/log.service';
import { HttpRequestJob } from './jobs/http-request.job';
import { SysLogClearJob } from './jobs/sys-log-clear.job';

const providers = [SysLogClearJob, HttpRequestJob];
function createAliasProviders() {
    const aliasProviders: any[] = [];
    for (const p of providers) {
        aliasProviders.push({
            provide: p.name,
            useExisting: p,
        });
    }
    return aliasProviders;
}

@Module({})
export class MissionModule {
    static forRoot(): DynamicModule {
        const aliasProviders = createAliasProviders();
        return {
            global: true,
            module: MissionModule,
            imports: [AdminModule],
            providers: [...providers, ...aliasProviders, SysLogService],
            exports: aliasProviders,
        };
    }
}
