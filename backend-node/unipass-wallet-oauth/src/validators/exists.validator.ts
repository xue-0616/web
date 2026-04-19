// Recovered from dist/exists.validator.js.map (source: ../../src/validators/exists.validator.ts)

import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';

@Injectable()
@ValidatorConstraint({ name: 'exists', async: true })
export class ExistsValidator implements ValidatorConstraintInterface {
    constructor(@InjectConnection() private readonly connection: Connection) {}

    async validate(value: string, args: ValidationArguments): Promise<boolean> {
        const [entityClass, findCondition] = args.constraints;
        return (await (this.connection.getRepository(entityClass) as any).count({ where: { [findCondition || args.property]: value } })) > 0;
    }

    defaultMessage(args: ValidationArguments): string {
        const [entityClass] = args.constraints;
        const entity = entityClass.name || 'Entity';
        return `The selected ${args.property}  does not exist in ${entity} entity`;
    }
}

export function Exists(constraints: any[], validationOptions?: ValidationOptions) {
    return (object: Record<string, any>, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints,
            validator: ExistsValidator,
        });
    };
}
