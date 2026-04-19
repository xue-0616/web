import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

import { MAX_PATH_CHARS } from './forwarding-path.validator';

export enum ApiMethod {
    POST = 0,
    Get = 1,
}

export class ForwardingApiInputDto {
    @ApiProperty({
        enum: ApiMethod,
        description: 'API method: 0 - POST, 1 - GET',
        example: ApiMethod.POST,
    })
    @IsEnum(ApiMethod)
    method!: ApiMethod;

    // BUG-S3 fix: `path` is a user-controlled string appended to the
    // configured Solana API URL. Restrict to a conservative alphabet
    // (slash, alnum, `_`, `-`, `.`) so callers can't inject query
    // strings, fragments, or traversal sequences. Detailed rationale
    // lives in forwarding-path.validator.ts.
    @ApiProperty({
        type: String,
        description: 'url patch, must start with / and use safe chars only',
        example: '/auth/message',
    })
    @IsString()
    @Length(1, MAX_PATH_CHARS, {
        message: `path length must be in (0, ${MAX_PATH_CHARS}]`,
    })
    @Matches(/^\/[A-Za-z0-9/_\-.]*$/, {
        message:
            "path must start with / and contain only [A-Za-z0-9/_.-]; no query, fragment, or scheme allowed",
    })
    @Matches(/^(?!.*\.\.).*$/, {
        message: 'path must not contain ..',
    })
    @Matches(/^(?!\/\/).*$/, {
        message: 'path must not start with //',
    })
    path!: string;

    @ApiProperty({
        type: String,
        description: 'api request json string',
    })
    @IsString()
    body!: string;
}
