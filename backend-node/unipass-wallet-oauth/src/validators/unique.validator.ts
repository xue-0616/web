// Recovered from dist/unique.validator.js.map (source: ../../src/validators/unique.validator.ts)

import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';

@Injectable()
@ValidatorConstraint({ name: 'unique', async: true })
export class UniqueValidator implements ValidatorConstraintInterface {
    constructor(@InjectConnection() private readonly connection: Connection) {}

    async validate(value: string, args: ValidationArguments): Promise<boolean> {
        const [entityClass, findCondition] = args.constraints;
        return (await (this.connection.getRepository(entityClass) as any).count({ where: { [findCondition || args.property]: value } })) <= 0;
    }

    defaultMessage(args: ValidationArguments): string {
        const [entityClass] = args.constraints;
        const entity = entityClass.name || 'Entity';
        return `${entity} with the same ${args.property} already exists`;
    }
}

export function Unique(constraints: any[], validationOptions?: ValidationOptions) {
    return function (object: Record<string, any>, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints,
            validator: UniqueValidator,
        });
    };
}
