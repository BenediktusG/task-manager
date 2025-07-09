import { ClientError } from "./client-error.js";

export class ValidationError extends ClientError {
    constructor(joiError) {
        super(400, "The request contains invalid fields", 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.details = joiError.map((item) => ({
            field: item.path.join('.'),
            message: item.message,
        }));
    };
};
