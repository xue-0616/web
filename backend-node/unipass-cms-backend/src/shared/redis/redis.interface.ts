import { ModuleMetadata } from '@nestjs/common';
import { Redis, ClusterNode, ClusterOptions } from 'ioredis';

export type RedisClient = Redis;

export interface RedisModuleOptions {
  name?: string;
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  cluster?: boolean;
  nodes?: ClusterNode[];
  clusterOptions?: ClusterOptions;
  [key: string]: any;
  onClientReady?: (client: Redis | any) => void;
}

export interface RedisModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<RedisModuleOptions | RedisModuleOptions[]> | RedisModuleOptions | RedisModuleOptions[];
  inject?: any[];
}
