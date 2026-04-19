import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Body, Controller, Post } from '@nestjs/common';
import { SwaggerBaseApiResponse } from '../../../interfaces/Response';
import { GetMigrateAddressInput, GetMigrateUserInfoInput } from '../dto/account';

@Controller('app')
export class MigrateController {
    constructor(logger: any, migrateService: any) {
        this.logger = logger;
        this.migrateService = migrateService;
        this.logger.setContext(MigrateController.name);
    }
    logger: any;
    migrateService: any;
    @ApiOperation({ summary: 'get Migrate User Info' })
    @ApiResponse({ type: SwaggerBaseApiResponse(GetMigrateUserInfoInput) })
    @Post('getMigrateUserInfo')
    async getMigrateUserInfo(@Body() input: any) {
            let data = await this.migrateService.getMigrateUserInfo(input);
            return data;
        }
    @ApiOperation({ summary: 'get Migrate Address' })
    @ApiResponse({ type: SwaggerBaseApiResponse(GetMigrateAddressInput) })
    @Post('getMigrateAddress')
    async getMigrateUserAddress(@Body() input: any) {
            let data = await this.migrateService.getMigrateUserAddress(input);
            return data;
        }
}
