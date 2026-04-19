import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountOutput {
    @ApiProperty({ type: Boolean })
    success: any;
}

export class IsDeleteAccountOutput {
    @ApiProperty({ type: Boolean })
    deleted: any;
}
