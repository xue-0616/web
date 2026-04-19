import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'ioredis';
import { REDIS_CLIENT, REDIS_DEFAULT_CLIENT_KEY } from '../redis/redis.constants';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly clients: Map<string, Redis | Cluster>,
  ) {}

  getRedis(name = REDIS_DEFAULT_CLIENT_KEY): Redis | Cluster {
    if (!this.clients.has(name)) {
      throw new Error(`redis client ${name} does not exist`);
    }
    return this.clients.get(name) as Redis | Cluster;
  }
}
