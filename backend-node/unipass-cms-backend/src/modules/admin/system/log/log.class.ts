export class LoginLogInfo {
    id!: number;
    ip!: string;
    os!: string;
    browser!: string;
    time!: Date;
    username!: string;
}

export class TaskLogInfo {
    id!: number;
    taskId!: number;
    name!: string;
    createdAt!: Date;
    consumeTime?: number;
    detail?: string;
    status!: number;
}
