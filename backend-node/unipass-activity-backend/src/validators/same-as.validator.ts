import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
} from 'class-validator';

export function SameAs(
    property: string,
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        registerDecorator({
            name: 'sameAs',
            target: object.constructor,
            propertyName: propertyName as string,
            options: validationOptions,
            constraints: [property],
            validator: {
                validate(value: unknown, args?: ValidationArguments) {
                    if (!args) return false;
                    const [relatedPropertyName] = args.constraints as [string];
                    return (args.object as Record<string, unknown>)[relatedPropertyName] === value;
                },
                defaultMessage() {
                    return '$property must match $constraint1';
                },
            },
        });
    };
}
