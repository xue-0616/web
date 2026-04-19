import { Controller, Get, Query } from '@nestjs/common';
import { OpenAccess } from '../../decorators/open.access.decorator';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { SnapshotInputDto } from './dto/snapshot.input.dto';
import { ExternalService } from './external.service';
import { SnapshotOutputDto } from './dto/snapshot.output.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@ApiTags('External Module')
@Controller()
export class ExternalController {
    constructor(private readonly logger: AppLoggerService, private readonly externalService: ExternalService) {
        this.logger.setContext(ExternalController.name);
    }
    @Get('token/snapshot')
    @OpenAccess()
    @ApiResponse({ type: SwaggerBaseApiResponse(SnapshotOutputDto) })
    async assetSnapshot(@Query() input: SnapshotInputDto): Promise<SnapshotOutputDto> {
            return await this.externalService.assetSnapshot(input);
        }
}
