export class CreateParamConfigDto {
    name!: string;
    key!: string;
    value!: string;
    remark?: string;
}

export class UpdateParamConfigDto {
    id!: number;
    name!: string;
    value!: string;
    remark?: string;
}

export class DeleteParamConfigDto {
    ids!: number[];
}

export class InfoParamConfigDto {
    id!: number;
}
