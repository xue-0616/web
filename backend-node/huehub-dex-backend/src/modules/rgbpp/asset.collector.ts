import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { DeployOutputDto } from './dto/deploy.outputs.dto';
import { DeployInputDto } from './dto/deploy.input.dto';
import { AssetService } from './asset/asset.service';
import { RequestContext } from '../../common/interface/request.context';
import { PreDeployOutputDto } from './dto/pre.deploy.cell.outputs.dto';
import { PreDeployInputDto } from './dto/pre.deploy.cell.input.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('RGBPP Asset Module')
@Controller('rgbpp/asset')
export class RgbppAssetCollectorService {
    constructor(private readonly logger: AppLoggerService, private readonly assetService: AssetService) {
        this.logger.setContext(RgbppAssetCollectorService.name);
    }
    @Post('deploy')
    @ApiOperation({ summary: 'deploy token' })
    @ApiResponse({ type: SwaggerBaseApiResponse(DeployOutputDto) })
    async deploy(@Request() ctx: RequestContext, @Body() deployInput: DeployInputDto): Promise<DeployOutputDto> {
            return await this.assetService.deploy(ctx.user, deployInput);
        }
    @Post('pre_deploy')
    @ApiOperation({ summary: 'per deploy' })
    @ApiResponse({ type: SwaggerBaseApiResponse(PreDeployOutputDto) })
    async getCandidateCell(@Request() ctx: RequestContext, @Body() input: PreDeployInputDto): Promise<PreDeployOutputDto> {
            return await this.assetService.getPreDeploy(ctx.user, input);
        }
}
