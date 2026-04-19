export function healthCheck(_req: unknown): Promise<boolean> {
    return new Promise(function (resolve, _reject) {
        resolve(true);
    });
}
