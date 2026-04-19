export class Runtime {
    os!: string;
    arch!: string;
    nodeVersion!: string;
    npmVersion!: string;
}

export class CoreLoad {
    rawLoad!: number;
    rawLoadIdle!: number;
}

export class Cpu {
    manufacturer!: string;
    brand!: string;
    physicalCores!: number;
    model!: string;
    speed!: number;
    rawCurrentLoad!: number;
    rawCurrentLoadIdle!: number;
    coresLoad!: CoreLoad[];
}

export class Disk {
    size!: number;
    used!: number;
    available!: number;
}

export class Memory {
    total!: number;
    available!: number;
}

export class ServeStatInfo {
    runtime!: Runtime;
    cpu!: Cpu;
    disk!: Disk;
    memory!: Memory;
}
