import { Injectable } from '@nestjs/common';

@Injectable()
export class ValidatorService {
    isImage(mimeType: any) {
            const imageMimeTypes = ['image/jpeg', 'image/png'];
            return imageMimeTypes.includes(mimeType);
        }
}
