import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'xudtTypeHash', async: false })
export class TypeHashtValidator implements ValidatorConstraintInterface {
    validate(value: string, args?: ValidationArguments): boolean {
        if (!value) {
            return false;
        }
        const typeHash = value.replace('0x', '');
        if (typeHash.length !== 64) {
            return false;
        }
        const hexRegex = /^[0-9A-Fa-f]+$/g;
        return hexRegex.test(typeHash);
    }
}
