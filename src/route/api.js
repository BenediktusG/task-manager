import express from 'express';
import { authMiddleware } from '../middleware/auth-middleware.js';
import userController from '../controller/user-controller.js';
import tenantController from '../controller/tenant-controller.js';

export const userRouter = new express.Router();
userRouter.use(authMiddleware);

// User API
userRouter.get('/auth/me', userController.getCurrentUserInformation);
userRouter.patch('/auth/me', userController.editCurrentUserInformation);
userRouter.delete('/auth/me', userController.deleteUser);
userRouter.patch('/auth/password', userController.changePassword);
userRouter.get('/users/invitations', userController.getAllInvitations);
userRouter.get('/users/invitations/:invitationId', userController.getInvitationById);
userRouter.post('/users/invitations/:invitationId/accept', userController.acceptInvitation);

// Tenant API
userRouter.post('/tenants', tenantController.create);
userRouter.get('/tenants', tenantController.getAssociatedTenants);
userRouter.get('/tenants/:tenantId', tenantController.getTenantById);
userRouter.put('/tenants/:tenantId', tenantController.edit);
userRouter.delete('/tenants/:tenantId', tenantController.deleteTenant);
userRouter.post('/tenants/:tenantId/invite', tenantController.inviteUser);
userRouter.get('/tenants/:tenantId/members', tenantController.getAllMembers);
userRouter.get('/tenants/:tenantId/invitations', tenantController.getAllInvitations);
userRouter.get('/tenants/:tenantId/invitations/:invitationId', tenantController.getSpecificInvitationById);
userRouter.delete('/tenants/:tenantId/invitations/:invitationId', tenantController.deleteInvitation);
userRouter.delete('/tenants/:tenantId/members/me', tenantController.leaveTenant);
userRouter.patch('/tenants/:tenantId/members/:userId', tenantController.editMemberRole);
userRouter.delete('/tenants/:tenantId/members/:userId', tenantController.deleteMember);
userRouter.post('/tenants/:tenantId/join', tenantController.joinTenant);
userRouter.get('/tenants/:tenantId/join-requests', tenantController.getAllJoinRequests);