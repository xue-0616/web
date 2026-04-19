import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetAccountKeyset {
    @ApiPropertyOptional({ description: 'account master key address' })
    masterKeyAddress: any;
    @ApiPropertyOptional({ description: 'account keyset' })
    keyset: any;
}

export class QueryAccountKeysetOutput extends GetAccountKeyset {
    @ApiPropertyOptional({ description: 'query send recovery email address' })
    accountAddress: any;
}

export class AccountKeyset {
}
