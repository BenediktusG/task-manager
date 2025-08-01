import { io } from "../application/web"

const emitTaskCreated = (task) => {
    io.to(`tenant:${task.tenantId}`).emit('task/created', task);
};

const emitTaskUpdated = (task) => {
    io.to(`tenant:${task.tenantId}`).emit('task/updated', task);
};

export default {
    emitTaskCreated,
    emitTaskUpdated,
};