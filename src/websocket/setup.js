import { Server } from "socket.io"
import { registerUserEvents } from "./userEvents.js";

export const setupWebSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    io.on('connection', (socket) => {
        registerUserEvents(io, socket);
    });
    
    return io;
};