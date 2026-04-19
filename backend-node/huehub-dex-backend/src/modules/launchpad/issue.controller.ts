import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateIssueStatusInputDto } from './dto/update.issue.status.input.dto';
import { GetIssueAddressInputDto } from './dto/get.issue.address.input.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';
import { GetIssueAddressOutputDto } from './dto/get.issue.address.output.dto';
import { UpdateIssueStatusOutputDto } from './dto/update.issue.status.output.dto';

@Controller('launchpad/issue')
@ApiTags('Launchpad Issue')
export class IssueController {
    @Get('')
    @ApiOperation({ summary: 'Get issue Address' })
    @ApiResponse({ type: SwaggerBaseApiResponse(GetIssueAddressOutputDto) })
    async getIssueAddress(@Query() input: GetIssueAddressInputDto): Promise<void> {
            return;
        }
    @Post('status')
    @ApiOperation({ summary: 'update issue status' })
    @ApiResponse({ type: SwaggerBaseApiResponse(UpdateIssueStatusOutputDto) })
    async updateIssueStatus(@Body() input: UpdateIssueStatusInputDto): Promise<void> {
            return;
        }
}
