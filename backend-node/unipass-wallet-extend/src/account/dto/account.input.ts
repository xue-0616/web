import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({
        description: 'authorization mailbox list output data',
    })
export class Config {
    mailServices!: string[];
}

@InputType({
        description: 'wallet address',
    })
export class AddressInput {
    @Field(() => String, {
        description: 'wallet address',
    })
    address!: string;
}

@ObjectType({
        description: 'wallet address',
    })
export class AddressOutput {
    @Field(() => Boolean, {
        description: 'wallet address',
    })
    isUniPass!: boolean;
}
