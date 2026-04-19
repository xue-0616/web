import { PageOptionsDto } from '../../../common/dto/page.dto';

export class RelayerGasInput extends PageOptionsDto {
    submitter?: string;
    chainId?: number | string;
    start?: string | number;
    end?: string | number;
    isAccountTx?: boolean;
}

export class AccountTypeInput {
    isAccountTx?: boolean;
}
