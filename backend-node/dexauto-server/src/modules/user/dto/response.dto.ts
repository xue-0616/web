import { WalletInfoDto } from '../../wallet/dto/response.dto';
import { ChainDto } from '../../../common/dto/chain';
import { User } from '../entities/user.entity';
import { getResponseType } from '../../../common/dto/response';
import { GenericAddress } from '../../../common/genericAddress';

export class UserInfoDto {
}
export const DEFAULT_LANGUAGE = 'en';
export function getUserInfoDto(user: any, evmWallets: any[], solanaWallets: any[]) {
    const addr = new GenericAddress(user.boundChain, user.boundAddr);
    return {
        id: user.id,
        language: user.language ?? DEFAULT_LANGUAGE,
        boundAddr: addr.address(),
        boundChain: user.boundChain,
        solanaWallets,
        evmWallets,
    };
}
export class UserLoginResponseDto {
}
export class UserLoginResponse extends getResponseType(UserLoginResponseDto) {
}
export class UserInfoResponse extends getResponseType(UserInfoDto) {
}
export class UserAuthResponseDto {
    isWhiteList!: boolean;
}
export class UserAuthResponse extends getResponseType(UserAuthResponseDto) {
}
