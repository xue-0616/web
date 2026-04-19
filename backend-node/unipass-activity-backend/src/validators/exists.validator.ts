import { Injectable } from '@nestjs/common';
import {
    ValidatorConstraint,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';
import { InjectConnection } from '@nestjs/typeorm';

@Injectable()
@ValidatorConstraint({ name: 'exists', async: true })
export class ExistsValidator {
    constructor(@InjectConnection() connection: any) {
        this.connection = connection;
    }
    connection: any;
    async validate(value: any, args: any) {
            const [entityClass, findCondition = args.property] = args.constraints;
            return ((await this.connection.getRepository(entityClass).count({
                where: typeof findCondition === 'function'
                    ? findCondition(args)
                    : {
                        [findCondition || args.property]: value,
                    },
            })) > 0);
        }
    defaultMessage(args: any) {
            const [entityClass] = args.constraints;
            const entity = entityClass.name || 'Entity';
            return `The selected ${args.property}  does not exist in ${entity} entity`;
        }
}

export function Exists(
    constraints: unknown[],
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return (object: object, propertyName: string | symbol): void => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            constraints,
            validator: ExistsValidator,
        });
    };
}
