import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dump } from 'js-yaml';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RedocModule } from '@jozefazz/nestjs-redoc';

export async function setupSwagger(app: INestApplication): Promise<void> {
    const options = new DocumentBuilder()
        .setTitle('Mystery-bomb-box API')
        .setDescription('Mystery-bomb-box API description')
        .setVersion('1.0')
        .build();
    const document = SwaggerModule.createDocument(app, options);
    const yamlStr = dump(document);
    const docsDir = './docs';
    if (!existsSync(docsDir)) {
        mkdirSync(docsDir, { recursive: true });
    }
    const filePath = join(docsDir, 'api.yaml');
    writeFileSync(filePath, yamlStr, 'utf8');
    const redocOptions = {
        title: 'Mystery-bomb-box Docs',
        sortPropsAlphabetically: true,
        hideDownloadButton: false,
        hideHostname: false,
    };
    await RedocModule.setup('/docs', app, document, redocOptions);
}
