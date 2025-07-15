import Joi from 'joi';

const Roles = {
    member: 'MEMBER',
    admin: 'ADMIN',
    manager: 'MANAGER',
    superAdmin: 'SUPER_ADMIN'
};

const JoinRequestStatus = {
    pending: 'PENDING',
    accepted: 'ACCEPTED',
    rejected: 'REJECTED',
};

const createTenantValidation = Joi.object({
    name: Joi.string().min(4).max(20).required(),
    description: Joi.string().max(500).optional(),
});

const inviteUserValidation = Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string().valid(...Object.values(Roles)).required(),
    expiresAt: Joi.date().greater('now').required(),
});

const changeMemberRoleValidation = Joi.object({
    role: Joi.string().valid(...Object.values(Roles)).required(),
});

const joinRequestValidation = Joi.object({
    message: Joi.string().max(500).optional(),
});

const handleJoinRequestValidation = Joi.object({
    status: Joi.string().valid(...Object.values(JoinRequestStatus)).required(),
});

export {
    createTenantValidation,
    inviteUserValidation,
    changeMemberRoleValidation,
    joinRequestValidation,
    handleJoinRequestValidation,
};