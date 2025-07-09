import { ClientError } from "../error/client-error.js";
import { ValidationError } from "../error/validation-error.js";

export const errorMiddleware = async (err, req, res, next) => {
    if (!err) {
        next();
        return;
    }
    if (err instanceof ClientError) {
        if (err instanceof ValidationError) {
            res.status(err.status).json({
                success: false,
                error: {
                    code: err.code,
                    message: err.message,
                    details: err.details,
                }
            }).end();
        } else {
            res.status(err.status).json({
                success: false,
                error: {
                    code: err.code,
                    message: err.message,
                },
            });
        }
    } else {
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVER_ERROR',
                message: err.message,
            }
        });
    }
};