import { ApiProperty } from '@nestjs/swagger';

export class ActionPointBalanceOutput {
    @ApiProperty()
    availActionPoint: any;
    @ApiProperty()
    lockActionPoint: any;
    @ApiProperty()
    decimal: any;
    @ApiProperty()
    discount: any;
    @ApiProperty()
    id: any;
    @ApiProperty()
    address: any;
}

export class ApHistoryListOutPut {
    @ApiProperty()
    actionPointDiff: any;
    @ApiProperty()
    changeType: any;
    @ApiProperty()
    status: any;
    @ApiProperty()
    changeTime: any;
    @ApiProperty()
    changeMsg: any;
    @ApiProperty()
    accountId: any;
}
