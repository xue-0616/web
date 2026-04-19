import { OpenAccess } from '../../decorators/open.access.decorator';
import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShowRoundsInput } from './dto/show.rounds.input.dto';
import { ShowRoundsOutput } from './dto/show.rounds.output.dto';
import { MintOutputDto } from './dto/mint.token.output.dto';
import { MintInputDto } from './dto/mint.token.input.dto';
import { MintCheckInputDto } from './dto/mint.check.input.dto';
import { LaunchpadProjectInputDto } from './dto/launchpad.project.input.dto';
import { LaunchpadProjectOutputDto } from './dto/launchpad.project.output.dto';
import { MintCheckOutputDto } from './dto/mint.check.output.dto';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { LaunchpadService } from './launchpad.service';
import { RequestContext } from '../../common/interface/request.context';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('launchpad')
@ApiTags('Launchpad')
export class LaunchpadController {
    constructor(private readonly logger: AppLoggerService, private readonly launchpadService: LaunchpadService) {
        this.logger.setContext(LaunchpadController.name);
    }
    @OpenAccess()
    @Get('projects')
    @ApiOperation({ summary: 'launchpad/projects' })
    @ApiResponse({ type: SwaggerBaseApiResponse(LaunchpadProjectOutputDto) })
    async getProjectsStatus(@Query() input: LaunchpadProjectInputDto): Promise<LaunchpadProjectOutputDto> {
            return await this.launchpadService.getProjectsStatus(input);
        }
    @OpenAccess()
    @Get('rounds')
    @ApiOperation({ summary: 'launchpad/rounds' })
    @ApiResponse({ type: SwaggerBaseApiResponse(ShowRoundsOutput) })
    async showRounds(@Query() input: ShowRoundsInput): Promise<ShowRoundsOutput> {
            return await this.launchpadService.showRounds(input);
        }
    @Get('mint/check')
    @ApiOperation({
        summary: 'launchpad/mint/check',
        description: 'need authorization',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(MintCheckOutputDto) })
    async mintCheck(@Request() ctx: RequestContext, @Query() input: MintCheckInputDto): Promise<MintCheckOutputDto> {
            return await this.launchpadService.mintCheck(ctx.user, input);
        }
    @Post('mint')
    @ApiOperation({
        summary: 'launchpad/mint',
        description: 'need authorization',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(MintOutputDto) })
    async mintToken(@Request() ctx: RequestContext, @Body() input: MintInputDto): Promise<MintOutputDto> {
            return await this.launchpadService.mintToken(ctx.user, input);
        }
}
