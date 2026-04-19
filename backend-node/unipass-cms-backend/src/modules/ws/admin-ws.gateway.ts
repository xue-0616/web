import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from './auth.service';
import { EVENT_OFFLINE, EVENT_ONLINE } from './ws.event';

@WebSocketGateway()
export class AdminWSGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  wss!: Server;

  constructor(private readonly authService: AuthService) {}

  get socketServer(): Server {
    return this.wss;
  }

  afterInit(): void {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      this.authService.checkAdminAuthToken(client.handshake?.query?.token ?? '');
    } catch {
      client.disconnect();
      return;
    }

    client.broadcast.emit(EVENT_ONLINE);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    client.broadcast.emit(EVENT_OFFLINE);
  }
}
