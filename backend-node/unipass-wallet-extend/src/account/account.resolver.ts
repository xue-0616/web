import { Args, Query, Resolver } from '@nestjs/graphql';
import { AccountService } from './account.service';
import { AddressOutput } from './dto/account.input';

@Resolver()
export class AccountResolver {
    constructor(private readonly accountService: AccountService) {
    }
    @Query(() => AddressOutput)
    isUniPassAddress(@Args('address') address: string): Promise<AddressOutput> {
            return this.accountService.getIsUniPassAccount(address);
        }
}
