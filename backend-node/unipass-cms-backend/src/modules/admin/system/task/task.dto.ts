import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { isEmpty } from 'lodash';
import * as parser from 'cron-parser';

@ValidatorConstraint({ name: 'isCronExpression', async: false })
export class IsCronExpression implements ValidatorConstraintInterface {
    validate(value: string, args?: ValidationArguments): boolean {
        try {
            if (isEmpty(value)) throw new Error('cron expression is empty');
            parser.parseExpression(value);
            return true;
        } catch { return false; }
    }
    defaultMessage(_args?: ValidationArguments): string {
        return 'this cron expression ($value) invalid';
    }
}

export class CreateTaskDto {
    name!: string;
    service!: string;
    type!: number;
    cron?: string;
    every?: number;
    data?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    status?: number;
}

export class UpdateTaskDto extends CreateTaskDto {
    id!: number;
}

export class CheckIdTaskDto {
    id!: number;
}
