import { redis } from "../application/redis.js";
import tenantService from "../service/tenant-service.js";
import { verifyToken } from "../utils/jwtUtils.js";

export const registerUserEvents = (socket) => {
    socket.on('user/login', async (token) => {
        const information = verifyToken(token);
        if (information) {
            const { userId } = information;
            redis.set(`socketId:${userId}`, socket.id, 'EX', process.env.REDIS_TTL);
            const tenants = await tenantService.getAllTenants(userId);
            tenants.forEach(tenant => {
                socket.join(`tenant${tenant}`);
            });
        }
    });
};