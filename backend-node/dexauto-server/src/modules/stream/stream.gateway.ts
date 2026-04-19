import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { WebSocket, Server } from 'ws';
import { StreamService } from './stream.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/** Maximum concurrent WebSocket connections per IP address */
const MAX_CONNECTIONS_PER_IP = 10;
/** Maximum pool subscriptions per single WebSocket client */
const MAX_SUBSCRIPTIONS_PER_CLIENT = 20;

@WebSocketGateway({
    cors: true,
    path: '/stream',
    allowUpgrades: true,
    handlePreflightRequest: true,
    allowEIO3: true,
})
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private streamService: StreamService;
    private logger: Logger;
    private clientSubscribers: Map<WebSocket, any>;
    private jwtService: JwtService;
    private configService: ConfigService;
    /** Track connection count per IP address */
    private connectionsPerIp: Map<string, number>;
    /** Track which IP each client connected from */
    private clientIp: Map<WebSocket, string>;
    /** Track subscription count per client */
    private clientSubscriptionCount: Map<WebSocket, number>;

    constructor(streamService: StreamService, jwtService: JwtService, configService: ConfigService) {
        this.streamService = streamService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.logger = new Logger(StreamGateway.name);
        this.clientSubscribers = new Map();
        this.connectionsPerIp = new Map();
        this.clientIp = new Map();
        this.clientSubscriptionCount = new Map();
    }
    handleConnection(client: any, ...args: any[]): void {
        const req = args[0];

        // --- ST-3: Enforce per-IP connection limit ---
        const ip = req?.socket?.remoteAddress || req?.headers?.['x-forwarded-for'] || 'unknown';
        const currentCount = this.connectionsPerIp.get(ip) || 0;
        if (currentCount >= MAX_CONNECTIONS_PER_IP) {
            this.logger.warn(`WebSocket connection rejected: IP ${ip} exceeded max connections (${MAX_CONNECTIONS_PER_IP})`);
            client.close(4429, 'Too many connections');
            return;
        }

        try {
            // Extract token from query string or protocol header
            let token: string | undefined;
            if (req && req.url) {
                const url = new URL(req.url, 'http://localhost');
                token = url.searchParams.get('token') ?? undefined;
            }
            if (!token && req && req.headers && req.headers.authorization) {
                const [type, bearerToken] = req.headers.authorization.split(' ');
                if (type === 'Bearer') {
                    token = bearerToken;
                }
            }
            if (!token) {
                this.logger.warn('WebSocket connection rejected: no auth token');
                client.close(4401, 'Unauthorized: token required');
                return;
            }
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('jwtSecret'),
            });
            if (!payload || !payload.sub) {
                this.logger.warn('WebSocket connection rejected: invalid token payload');
                client.close(4401, 'Unauthorized: invalid token');
                return;
            }
            this.logger.log(`Client connected (user: ${payload.sub})`);
        } catch (error) {
            this.logger.warn(`WebSocket connection rejected: ${(error as Error).message}`);
            client.close(4401, 'Unauthorized: invalid token');
            return;
        }

        // Track IP connection
        this.connectionsPerIp.set(ip, currentCount + 1);
        this.clientIp.set(client, ip);
        this.clientSubscriptionCount.set(client, 0);

        this.clientSubscribers.set(client, undefined);
        client.on('message', (rawData: any) => {
            try {
                const message = JSON.parse(rawData.toString());
                // --- ST-2: Validate message schema ---
                if (typeof message !== 'object' || message === null) {
                    this.sendError(client, 0, -32600, 'Invalid message: expected JSON object');
                    return;
                }
                if (typeof message.method !== 'string') {
                    this.sendError(client, message.id ?? 0, -32600, 'Invalid message: missing or invalid "method" field');
                    return;
                }
                if (message.params !== undefined && !Array.isArray(message.params)) {
                    this.sendError(client, message.id ?? 0, -32602, 'Invalid message: "params" must be an array');
                    return;
                }
                this.handleMessage(client, message);
            }
            catch (error) {
                this.sendError(client, 0, -32700, (error as Error).message);
            }
        });
    }
    handleDisconnect(client: any): void {
        const clientSubscription = this.clientSubscribers.get(client);
        if (clientSubscription) {
            this.streamService.unsubscribe(clientSubscription);
        }
        this.clientSubscribers.delete(client);
        this.clientSubscriptionCount.delete(client);

        // Decrement IP connection counter
        const ip = this.clientIp.get(client);
        if (ip) {
            const count = this.connectionsPerIp.get(ip) || 0;
            if (count <= 1) {
                this.connectionsPerIp.delete(ip);
            } else {
                this.connectionsPerIp.set(ip, count - 1);
            }
            this.clientIp.delete(client);
        }

        this.logger.log('Client disconnected');
    }
    async handleMessage(client: any, message: any) {
        try {
            switch (message.method) {
                case 'subscribe': {
                    if (!message.params || message.params.length < 2) {
                        this.sendError(client, message.id ?? 0, -32602, 'subscribe requires [poolAddress, type] params');
                        return;
                    }
                    const [poolAddress, type] = message.params;
                    if (typeof poolAddress !== 'string' || typeof type !== 'string') {
                        this.sendError(client, message.id ?? 0, -32602, 'poolAddress and type must be strings');
                        return;
                    }

                    // ST-5/ST-7: Validate pool address format (base58, 32-44 chars)
                    if (poolAddress.length < 32 || poolAddress.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(poolAddress)) {
                        this.sendError(client, message.id ?? 0, -32602, 'Invalid pool address format');
                        return;
                    }

                    // --- ST-4: Enforce per-client subscription limit ---
                    const currentSubCount = this.clientSubscriptionCount.get(client) || 0;
                    const existingSub = this.clientSubscribers.get(client);
                    const isNewPool = !existingSub || existingSub.poolAddress !== poolAddress;
                    if (isNewPool && currentSubCount >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
                        this.sendError(client, message.id ?? 0, -32000, `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CLIENT}) exceeded`);
                        return;
                    }

                    let subscription = this.clientSubscribers.get(client);
                    if (!subscription) {
                        subscription = {
                            poolAddress,
                            types: new Set([type]),
                            client,
                        };
                        this.clientSubscribers.set(client, subscription);
                        this.clientSubscriptionCount.set(client, currentSubCount + 1);
                        this.logger.log(`Client ${client} subscribed to ${type}`);
                    }
                    else {
                        if (isNewPool) {
                            this.clientSubscriptionCount.set(client, currentSubCount + 1);
                        }
                        subscription.types.add(type);
                        subscription.poolAddress = poolAddress;
                        subscription.client = client;
                    }
                    this.streamService.subscribe(poolAddress, subscription);
                    client.send(JSON.stringify({
                        status: 200,
                    }));
                    break;
                }
                case 'unsubscribe': {
                    const [type] = message.params;
                    const clientSubscription = this.clientSubscribers.get(client);
                    if (clientSubscription) {
                        clientSubscription.types.delete(type);
                        if (clientSubscription.types.size === 0) {
                            this.streamService.unsubscribe(clientSubscription);
                            this.clientSubscribers.delete(client);
                        }
                    }
                    break;
                }
                default:
                    this.sendError(client, message.id, -32601, 'Method not found');
            }
        }
        catch (error) {
            this.sendError(client, message.id, -32603, (error as Error).message);
        }
    }
    sendError(client: any, id: any, code: any, message: any) {
        client.send(JSON.stringify({
            error: { code, message },
            id,
        }), (error: any) => {
            if (error) {
                this.logger.error(error);
                this.handleDisconnect(client);
            }
        });
    }
}
