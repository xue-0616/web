import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'clusterTypeHash', async: false })
export class TypeHashValidator implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments): boolean {
            if (!value) {
                return false;
            }
            let typeHash = value.replace('0x', '');
            if (typeHash.length !== 64) {
                return false;
            }
            const hexRegex = /^[0-9A-Fa-f]+$/g;
            return hexRegex.test(typeHash);
        }
}
