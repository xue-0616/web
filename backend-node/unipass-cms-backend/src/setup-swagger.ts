import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ADMIN_PREFIX } from './modules/admin/admin.constants';

export function setupSwagger(app: INestApplication) {
    const configService = app.get(ConfigService);
    const enable = configService.get('swagger.enable', true);
    if (!enable) {
        return;
    }
    const swaggerConfig = new DocumentBuilder()
        .setTitle(configService.get('swagger.title') ?? 'API')
        .setDescription(configService.get('swagger.desc') ?? '')
        .setLicense('MIT', 'https://github.com/buqiyuan/nest-admin')
        .addSecurity(ADMIN_PREFIX, {
        description: '后台管理接口授权',
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
    })
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(configService.get('swagger.path', '/swagger-api'), app, document);
}
