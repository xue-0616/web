import { Injectable } from '@nestjs/common';

// Recovered from dist/validator.service.js.map (source: ../../../src/shared/services/validator.service.ts)

@Injectable()
export class ValidatorService {
    isImage(mimeType: string): boolean {
        const imageMimeTypes = ['image/jpeg', 'image/png'];
        return imageMimeTypes.includes(mimeType);
    }
}
