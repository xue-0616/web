import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EmailStatus {
    pending = 0,
    receive = 1,
    committed = 2,
}

export class QueryRecoveryOutput {
    @ApiPropertyOptional({ description: 'query send recovery email address' })
    emailHash: any;
    @ApiPropertyOptional({
        description: 'email status 0:pending,1:receive,2:failed',
    })
    status: any;
    @ApiPropertyOptional({
        description: 'start recovery transaction hash',
    })
    transactionHash: any;
}
