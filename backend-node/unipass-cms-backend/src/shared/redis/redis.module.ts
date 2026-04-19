import { DynamicModule, Module, OnModuleDestroy } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { isEmpty } from 'lodash';
import { RedisModuleAsyncOptions, RedisModuleOptions } from './redis.interface';
import { REDIS_CLIENT, REDIS_DEFAULT_CLIENT_KEY, REDIS_MODULE_OPTIONS } from './redis.constants';

@Module({})
export class RedisModule implements OnModuleDestroy {
  static register(options: RedisModuleOptions | RedisModuleOptions[]): DynamicModule {
    const clientProvider = this.createAsyncProvider();
    return {
      module: RedisModule,
      providers: [
        clientProvider,
        {
          provide: REDIS_MODULE_OPTIONS,
          useValue: options,
        },
      ],
      exports: [clientProvider],
    };
  }

  static registerAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const clientProvider = this.createAsyncProvider();
    return {
      module: RedisModule,
      imports: options.imports ?? [],
      providers: [clientProvider, this.createAsyncClientOptions(options)],
      exports: [clientProvider],
    };
  }

  private static createAsyncProvider() {
    return {
      provide: REDIS_CLIENT,
      useFactory: (options: RedisModuleOptions | RedisModuleOptions[]) => {
        const clients = new Map<string, Redis | Cluster>();
        if (Array.isArray(options)) {
          options.forEach((op) => {
            const name = op.name ?? REDIS_DEFAULT_CLIENT_KEY;
            if (clients.has(name)) {
              throw new Error('Redis Init Error: name must unique');
            }
            clients.set(name, this.createClient(op));
          });
        } else {
          clients.set(REDIS_DEFAULT_CLIENT_KEY, this.createClient(options));
        }
        return clients;
      },
      inject: [REDIS_MODULE_OPTIONS],
    };
  }

  private static createClient(options: RedisModuleOptions): Redis | Cluster {
    const { onClientReady, url, cluster, clusterOptions, nodes, ...opts } = options;
    let client: Redis | Cluster;
    if (!isEmpty(url)) {
      client = new Redis(url as string);
    } else if (cluster) {
      client = new Redis.Cluster(nodes ?? [], clusterOptions);
    } else {
      client = new Redis(opts);
    }
    if (onClientReady) {
      onClientReady(client);
    }
    return client;
  }

  private static createAsyncClientOptions(options: RedisModuleAsyncOptions) {
    return {
      provide: REDIS_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject,
    };
  }

  onModuleDestroy(): void {
    return;
  }
}
