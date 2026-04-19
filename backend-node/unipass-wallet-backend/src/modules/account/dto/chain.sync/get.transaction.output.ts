import { ApiProperty } from '@nestjs/swagger';

export class GetTransactionOutPut {
    @ApiProperty({
        description: 'sync tx is add deployer tx',
    })
    isNeedDeploy: any;
    @ApiProperty({
        description: 'sync txs',
    })
    transactions: any;
    @ApiProperty({
        description: 'account init keyset hash',
    })
    initKeysetHash: any;
}
