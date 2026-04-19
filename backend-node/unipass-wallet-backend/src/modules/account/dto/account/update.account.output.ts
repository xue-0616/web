import { ApiProperty } from '@nestjs/swagger';

export class UpdateAccountPasswordOutput {
    @ApiProperty({
        description: 'account password update status, true:update success, false:update fail',
    })
    status: any;
}
