import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dump } from 'js-yaml';
import { writeFileSync } from 'fs';
import { RedocModule } from '@jozefazz/nestjs-redoc';

export async function setupSwagger(app: any) {
    const options = new DocumentBuilder()
        .setTitle('Hue Hub Dex API')
        .setDescription('Hue Hub Dex API description')
        .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, options);
    const yamlStr = dump(document);
    writeFileSync('./docs/api.yaml', yamlStr, 'utf8');
    const redocOptions = {
        title: 'Hue hub Dex Docs',
        sortPropsAlphabetically: true,
        hideDownloadButton: false,
        hideHostname: false,
    };
    await RedocModule.setup('/huehub/docs', app, document, redocOptions);
}
