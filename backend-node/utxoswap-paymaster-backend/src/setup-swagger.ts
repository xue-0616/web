import type { INestApplication } from '@nestjs/common';
import { RedocModule } from '@jozefazz/nestjs-redoc';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { dump } from 'js-yaml';

export async function setupSwagger(app: INestApplication) {
    const options = new DocumentBuilder()
        .setTitle('UTXOSwap API')
        .setDescription('UTXOSwap API description')
        .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, options);
    const yamlStr = dump(document);
    writeFileSync('./docs/api.yaml', yamlStr, 'utf8');
    const redocOptions = {
        title: 'UTXOSwap API Docs',
        sortPropsAlphabetically: true,
        hideDownloadButton: false,
        hideHostname: false,
    };
    await RedocModule.setup('/docs', app, document, redocOptions);
}
