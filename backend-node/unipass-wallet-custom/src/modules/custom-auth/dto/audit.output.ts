import { ApiProperty } from '@nestjs/swagger';

export enum AuditStatus {
    Approved = 0,
    Rejected = 1,
    Confirming = 2,
}

export class AuditSignContentOutput {
    @ApiProperty({ description: 'approve status' })
    approveStatus: any;
}

export class UpSignTokenOutput {
    @ApiProperty({
        type: String,
        description: 'unipas jwt authorization token',
    })
    authorization: any;
}
