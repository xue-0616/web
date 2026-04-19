import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const getConfiguration = () => ({
    rootRoleId: parseInt(process.env.ROOT_ROLE_ID || '1'),
    mailer: {
        host: 'xxx',
        port: 80,
        auth: {
            user: 'xxx',
            pass: 'xxx',
        },
        secure: false,
    },
    amap: {
        key: 'xxx',
    },
    jwt: {
        secret: process.env.JWT_SECRET || '123456',
    },
    database: {
        type: 'mysql',
        host: process.env.MYSQL_HOST,
        port: Number.parseInt(process.env.MYSQL_PORT ?? '0', 10),
        username: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        entities: [__dirname + '/../**/entities/default/*.entity.{ts,js}'],
        migrations: ['dist/src/migrations/**/*.js'],
        autoLoadEntities: true,
        synchronize: true,
        logging: ['error'],
        timezone: '+08:00',
        cli: {
            migrationsDir: 'src/migrations',
        },
    },
    unipass_database: {
        type: 'mysql',
        host: process.env.UNIPASS_MYSQL_HOST,
        port: Number.parseInt(process.env.UNIPASS_MYSQL_PORT ?? '0', 10),
        username: process.env.UNIPASS_MYSQL_USERNAME,
        password: process.env.UNIPASS_MYSQL_PASSWORD,
        database: process.env.UNIPASS_MYSQL_DATABASE,
        entities: [__dirname + '/../**/entities/unipass/*.entity.{ts,js}'],
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
    },
    custom_auth_database: {
        type: 'mysql',
        host: process.env.CUSTOM_AUTH_MYSQL_HOST,
        port: Number.parseInt(process.env.CUSTOM_AUTH_MYSQL_PORT ?? '0', 10),
        username: process.env.CUSTOM_AUTH_MYSQL_USERNAME,
        password: process.env.CUSTOM_AUTH_MYSQL_PASSWORD,
        database: process.env.CUSTOM_AUTH_MYSQL_DATABASE,
        entities: [__dirname + '/../**/entities/custom-auth/*.entity.{ts,js}'],
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
    },
    snap_database: {
        type: 'mysql',
        host: process.env.SNAP_MYSQL_HOST,
        port: Number.parseInt(process.env.SNAP_MYSQL_PORT ?? '0', 10),
        username: process.env.SNAP_MYSQL_USERNAME,
        password: process.env.SNAP_MYSQL_PASSWORD,
        database: process.env.SNAP_MYSQL_DATABASE,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
    },
    payment_database: {
        type: 'mysql',
        host: process.env.UNIPASS_APP_MYSQL_HOST,
        port: Number.parseInt(process.env.UNIPASS_APP_MYSQL_PORT ?? '0', 10),
        username: process.env.UNIPASS_APP_MYSQL_USERNAME,
        password: process.env.UNIPASS_APP_MYSQL_PASSWORD,
        database: process.env.UNIPASS_APP_MYSQL_DATABASE,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
    },
    relayer_database: {
        type: 'mysql',
        host: process.env.RELAYER_MYSQL_HOST,
        port: Number.parseInt(process.env.RELAYER_MYSQL_PORT ?? '0', 10),
        username: process.env.RELAYER_MYSQL_USERNAME,
        password: process.env.RELAYER_MYSQL_PASSWORD,
        database: process.env.RELAYER_MYSQL_DATABASE,
        entities: [__dirname + '/../**/entities/relayer/*.entity.{ts,js}'],
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error'],
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? '0', 10),
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB,
    },
    logger: {
        timestamp: false,
        dir: process.env.LOGGER_DIR,
        maxFileSize: process.env.LOGGER_MAX_SIZE,
        maxFiles: process.env.LOGGER_MAX_FILES,
        errorLogName: process.env.LOGGER_ERROR_FILENAME,
        appLogName: process.env.LOGGER_APP_FILENAME,
    },
    swagger: {
        enable: process.env.SWAGGER_ENABLE === 'true',
        path: process.env.SWAGGER_PATH,
        title: process.env.SWAGGER_TITLE,
        desc: process.env.SWAGGER_DESC,
        version: process.env.SWAGGER_VERSION,
    },
});

export type Configuration = ReturnType<typeof getConfiguration>;
export type ConfigurationKeyPaths = keyof Configuration;

export default getConfiguration;
