import { Injectable } from '@nestjs/common';
import {
    ValidatorConstraint,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';
import { InjectConnection } from '@nestjs/typeorm';

@Injectable()
@ValidatorConstraint({ name: 'unique', async: true })
export class UniqueValidator {
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
            })) <= 0);
        }
    defaultMessage(args: any) {
            const [entityClass] = args.constraints;
            const entity = entityClass.name || 'Entity';
            return `${entity} with the same ${args.property} already exists`;
        }
}

export function Unique(
    constraints: unknown[],
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            constraints,
            validator: UniqueValidator,
        });
    };
}
