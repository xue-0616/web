import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { BaseApiResponse } from '../../interfaces';
import { StatusName } from '../../shared/utils';

@Controller('receive-email')
@ApiTags('receive-email')
export class ReceiveEmailController {
    constructor(receiveEmailService: any, logger: any) {
        this.receiveEmailService = receiveEmailService;
        this.logger = logger;
        this.logger.setContext(ReceiveEmailController.name);
    }
    receiveEmailService: any;
    logger: any;
    @ApiOperation({ summary: 'receive UniPass send email' })
    @Post('receive_mime')
    @ApiResponse({ type: BaseApiResponse })
    async receiveMailPost(@Body() receiveEmailInput: any) {
            if (!receiveEmailInput['body-mime']) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            try {
                return await this.receiveEmailService.receiveUserEmail(receiveEmailInput['body-mime']);
            }
            catch (error) {
                this.logger.error(`[receiveMailPost] ${error},${(error as Error)?.stack},data = ${JSON.stringify({
                    body: receiveEmailInput['body-mime'],
                })}`);
                return 'ok';
            }
        }
}
