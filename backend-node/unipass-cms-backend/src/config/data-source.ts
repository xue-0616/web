import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import getConfiguration from './configuration';

config({ path: '.env' });
export default new DataSource(getConfiguration().database as any);
