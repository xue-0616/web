import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';

export default registerAs('database', () => {;
    const secretPath = process.env.SECRET_PATH;
    if (!secretPath) {
        throw new Error('expected secret path');
    }
    const secretConfig = JSON.parse(readFileSync(secretPath).toString());
    // Allow configuring TLS certificate validation via environment variable.
    // Defaults to true (secure). Set DB_TLS_REJECT_UNAUTHORIZED=false only for dev/testing.
    const rejectUnauthorized = process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false';
    // DB_SSL=false disables TLS entirely (for local docker-run Postgres without certs).
    // Any other value (or unset) keeps the secure default.
    const sslEnabled = process.env.DB_SSL !== 'false';
    return {
        type: 'postgres',
        host: secretConfig.dbHost,
        port: secretConfig.dbPort,
        username: secretConfig.dbUsername,
        password: secretConfig.dbPassword,
        database: secretConfig.dbDatabase,
        autoLoadEntities: true,
        synchronize: false,
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        migrationsRun: true,
        ssl: sslEnabled ? { rejectUnauthorized } : false,
    };
});
