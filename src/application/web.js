import express from 'express';
import { errorMiddleware } from '../middleware/error-middleware.js';
import { publicRouter } from '../route/public-api.js';
import { userRouter } from '../route/api.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupWebSocket } from '../websocket/setup.js';
import http from 'http';

export const web = express();

web.use(express.json());
web.use(publicRouter);
web.use(userRouter);
web.use(errorMiddleware);

const server = http.createServer(web);

export const io = setupWebSocket(server);

const __filename = fileURLToPath(import.meta.url);
const isMain = path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
    server.listen(process.env.APP_PORT, () => {
        console.log(`Application is running in http://localhost:${process.env.APP_PORT}`);
    })
}