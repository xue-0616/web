import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { CustomAuthLoginOutput } from '../dto';

@Controller('custom-auth-account/admin')
@ApiTags('custom-auth-account/admin')
@UseGuards(AdminGuard)
export class CustomAuthAdminController {
    constructor(customAuthAdminService: any) {
        this.customAuthAdminService = customAuthAdminService;
    }
    customAuthAdminService: any;
    @Post('app-info')
    @ApiOperation({
        summary: 'custom-auth login api',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(CustomAuthLoginOutput) })
    insertOrUpdate(@Body() input: any) {
            const data = this.customAuthAdminService.insertOrUpdate(input);
            return data;
        }
}
