import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { SocketException } from '../../common/exceptions/socket.exception';

@Injectable()
export class AdminWsGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const client = context.switchToWs().getClient();
        const token = client?.handshake?.query?.token;
        try {
            this.authService.checkAdminAuthToken(token);
            return true;
        } catch (e) {
            client.disconnect();
            throw new SocketException(11001);
        }
    }
}
