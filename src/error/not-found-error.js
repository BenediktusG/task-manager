import { ClientError } from "./client-error.js";

export class NotFoundError extends ClientError {
    constructor(message, code) {
        super(404, message, code);
        this.name = 'NotFoundError';
    }
};