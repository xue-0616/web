import { Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export class ResponseDto {
    data!: any;
    code!: number;
    message?: string;
    constructor(code: number, data?: any, message?: string) {
        this.code = code;
        this.data = data;
        this.message = message;
    }
    static success(data: any) {
        return new ResponseDto(200, data);
    }
}

export class Pagination {
    total!: number;
    allCount?: number;
    page!: number;
    size!: number;
}

export class PaginatedResponseDto<T = any> {
    list!: T[];
    pagination!: Pagination;
}

export const ApiResponse = (dataDto: any, wrapperDataDto: any) => applyDecorators(ApiExtraModels(wrapperDataDto, dataDto), ApiOkResponse({
    schema: {
        allOf: [
            { $ref: getSchemaPath(wrapperDataDto) },
            { properties: { list: { type: 'array', items: { $ref: getSchemaPath(dataDto) } } } },
        ],
    },
}));
export const ApiOkResponseData = (dataDto: any) => ApiResponse(dataDto, ResponseDto);
export const ApiOkResponsePaginated = (dataDto: any) => ApiResponse(dataDto, PaginatedResponseDto);
