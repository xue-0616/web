import { WebSocket } from 'ws';

export interface ClientSubscription {
    client: WebSocket;
    poolAddress: string;
    types: Set<string>;
}
