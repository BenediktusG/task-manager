import { prismaClient } from "../application/database.js";
import { logger } from "../application/logging.js";
import { AuthenticationError } from "../error/authentication-error.js";
import { verifyToken } from "../utils/jwtUtils.js";

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.get('Authorization');
    // logger.debug(authHeader);
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    logger.debug(token);
    if (!token) {
        next(new AuthenticationError('You need to sign in to access this resource', 'AUTH_REQUIRED'));
    } else {
        // logger.debug(verifyToken(token));
        const information = verifyToken(token);
        if (!information) {
            return next(new AuthenticationError('Your token is invalid or expired', 'INVALID_ACCESS_TOKEN'));
        }
        const { userId } = information
        // logger.debug(userId);
        if (!userId) {
            next(new AuthenticationError('Your token is invalid or expired', 'INVALID_ACCESS_TOKEN'));
        } else {
            const user = await prismaClient.user.findUnique({
                where: {
                    id: userId,
                },
            });
            if (!user) {
                next(new AuthenticationError('You need to sign in to access this resource', 'AUTH_REQUIRED'));  
            }
            req.user = user;
            // logger.debug(req.user);
            next();
        }
    }
}