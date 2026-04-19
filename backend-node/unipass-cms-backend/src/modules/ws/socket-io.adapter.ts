import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class SocketIoAdapter extends IoAdapter {
    constructor(app: INestApplicationContext, private readonly configService: ConfigService) {
        super(app);
    }

    create(port: number, options?: any): any {
        port = Number(this.configService.get('WS_PORT') ?? 0);
        options.path = this.configService.get('WS_PATH');
        options.namespace = '/admin';
        return super.create(port, options);
    }

    createIOServer(port: number, options?: any): any {
        port = Number(this.configService.get('WS_PORT') ?? 0);
        options.path = this.configService.get('WS_PATH');
        options.namespace = '/admin';
        return super.createIOServer(port, options);
    }
}
