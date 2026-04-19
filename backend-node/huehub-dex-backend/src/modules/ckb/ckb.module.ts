import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CkbDeployerCellProviderService } from './ckb-deploy-cell-provider.service';
import { RgbppDistributorService } from './rgbpp-distributor.service';

@Module({
        imports: [CommonModule],
        providers: [CkbDeployerCellProviderService, RgbppDistributorService],
        exports: [CkbDeployerCellProviderService, RgbppDistributorService],
    })
export class CkbModule {
}
