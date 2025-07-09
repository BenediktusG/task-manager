import express from 'express';
import userController from '../controller/user-controller.js';

export const publicRouter = express.Router();

// User API
publicRouter.post('/auth/register', userController.register);
publicRouter.post('/auth/login', userController.login);
publicRouter.post('/auth/refresh', userController.refreshAccessToken);
publicRouter.post('/auth/logout', userController.logout);