export class UsageError extends Error {
    constructor(message: string, readonly source?: unknown) {
        super(message);
    }
}
