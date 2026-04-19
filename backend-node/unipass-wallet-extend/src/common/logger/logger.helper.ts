import { LoggerService } from 'nest-logger';

const loggerMapper = new Map();
export function getLogger(moduleName: string) {
    if (loggerMapper.get(moduleName)) {
        return loggerMapper.get(moduleName);
    }
    const loggers = [
        LoggerService.console({
            timeFormat: 'HH:mm:ss:SSS',
            consoleOptions: {
                level: 'info',
            },
        }),
        LoggerService.rotate({
            fileOptions: {
                filename: `logs/${moduleName}/%DATE%.log`,
                level: 'info',
            },
        }),
    ];
    const loggerService = new LoggerService('info', loggers);
    loggerMapper.set(moduleName, loggerService);
    return loggerService;
}
