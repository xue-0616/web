import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';

@Controller('customer/app')
@ApiTags('customer')
@UseGuards(UpJwtGuard)
export class AppController {
    constructor(appService: any) {
        this.appService = appService;
    }
    appService: any;
    @Post('create')
    async insertOrUpdate(@Body() input: any, @Request() req: any) {
            const data = await this.appService.insertOrUpdate(input, req.user);
            return data;
        }
}
