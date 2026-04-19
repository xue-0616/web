import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

export class GlobalThrottlerStorage implements ThrottlerStorage {
    constructor() {
        this.storage = new Map();
    }
    private storage: any;
    async getRecord(key: string): Promise<ThrottlerStorageRecord> {
            const record = this.storage.get(key);
            if (record && record.timeToExpire > Date.now()) {
                return record;
            }
            else {
                this.storage.delete(key);
                return { totalHits: 0, timeToExpire: 0 };
            }
        }
    async addRecord(key: string, ttl: number): Promise<void> {
            const record = await this.getRecord(key);
            if (record.totalHits === 0) {
                record.timeToExpire = Date.now() + ttl * 1000;
            }
            record.totalHits++;
            this.storage.set(key, record);
        }
    async resetKey(key: string): Promise<void> {
            this.storage.delete(key);
        }
    async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
            const record = await this.getRecord(key);
            if (record.totalHits === 0) {
                record.timeToExpire = Date.now() + ttl * 1000;
            }
            record.totalHits++;
            this.storage.set(key, record);
            return record;
        }
}
