import { redis } from "../application/redis.js";
import { io } from "../application/web.js"

const emitTaskCreated = (task) => {
    io.to(`tenant:${task.tenantId}`).emit('task/created', task);
};

const emitTaskUpdated = (task) => {
    io.to(`tenant:${task.tenantId}`).emit('task/updated', task);
};

const emitTaskAssigned = (task) => {
    const socketId = redis.get(`socketId:${task.assignedUserId}`);
    io.to(socketId).emit(task);
};

const emitTaskDeleted = (task) => {
    io.to(`tenant:${task.tenantId}`).emit(task);
};

export default {
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskAssigned,
    emitTaskDeleted,
};