import { prismaClient } from "../application/database.js";
import { logger } from "../application/logging.js";
import { AuthorizationError } from "../error/authorization-error.js";
import { ConflictError } from "../error/conflict-error.js";
import { NotFoundError } from "../error/not-found-error.js";
import { extractMembers, extractTenants } from "../utils/tenantUtils.js";
import { createTenantValidation, inviteUserValidation } from "../validation/tenant-validation.js"
import { validate } from "../validation/validation.js"

const create = async (request, user) => {
    const requestBody = validate(createTenantValidation, request);
    const tenantCount = await prismaClient.tenant.count({
        where: {
            name: requestBody.name,
        },
    });
    if (tenantCount > 0) {
        throw new ConflictError('Tenant name is already taken', 'TENANT_NAME_ALREADY_TAKEN');
    }
    const tenantResult = await prismaClient.tenant.create({
        data: requestBody,
    });
    await prismaClient.member.create({
        data: {
            userId: user.id,
            tenantId: tenantResult.id,
            role: 'SUPER_ADMIN',
        },
    });
    delete tenantResult.createdAt;
    if (!tenantResult.description) {
        delete tenantResult.description;
    }
    return tenantResult;
};

const getAssociatedTenants = async (user) => {
    const result = await prismaClient.member.findMany({
        where: {
            userId: user.id,
        },
        select: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                }
            },
        },
    });
    return extractTenants(result);
};

const getTenantById = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
    });
    if (!tenant) {
        throw new NotFoundError('Tenant id is invalid', 'NOT_FOUND_TENANT');
    }
    const checkMember = await prismaClient.member.count({
        where: {
            userId: user.ic,
            tenantId: tenantId,
        },
    });
    if (checkMember == 0) {
        return {
            id: tenant.id,
            name: tenant.name,
        };
    } else {
        return tenant;
    }
};

const edit = async (request, tenantId, user) => {
    const tenantInformation = validate(createTenantValidation, request);
    if (!tenantInformation.description) {
        tenantInformation.description = null;
    }
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
    });
    if (!tenant) {
        throw new NotFoundError('Failed to update tenant information because of invalid tenant id', 'NOT_FOUND_TENANT');
    }

    const AuthorizedMember = await prismaClient.member.count({
        where: {
            tenantId: tenantId,
            userId: user.id,
            role: 'SUPER_ADMIN',
        },
    });
    if (AuthorizedMember != 1) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const tenantFound = await prismaClient.tenant.findUnique({
        where: {
            name: tenantInformation.name,
        },
    });

    if (tenantFound && tenantFound.id !== tenantId) {
        throw new ConflictError('Tenant name is already taken', 'TENANT_NAME_ALREADY_TAKEN');
    }

    const result = await prismaClient.tenant.update({
        where: {
            id: tenantId,
        },
        data: tenantInformation,
    });

    delete result.createdAt;
    return result;
};

const deleteTenant = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });
    if (!tenant) {
        throw new NotFoundError('Failed to delete the tenant because of invalid tenant id', 'NOT_FOUND_TENANT');
    }
    const memberStatus = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
            role: "SUPER_ADMIN",
        },
        select: {
            id: true,
        },
    });
    if (!memberStatus) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }
    await prismaClient.tenant.delete({
        where: {
            id: tenantId,
        },
    });
};

const inviteUser = async (request, tenantId, user) => {
    const requestBody = validate(inviteUserValidation, request);
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });
    if (!tenant) {
        throw new NotFoundError('Failed to delete the tenant because of invalid tenant id', 'NOT_FOUND_TENANT');
    }
    const memberStatus = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
        },
        select: {
            role: true,
        }
    });
    if (!memberStatus) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }
    if (memberStatus.role !== 'ADMIN' && memberStatus.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const invitation = await prismaClient.invitation.findFirst({
        where: {
            tenantId: tenantId,
            email: request.email,
        },
        select: {
            id: true,
        },
    });
    logger.debug(invitation);

    if (invitation) {
        throw new ConflictError('invitation has been sent before', 'INVITATION_ALREADY_EXIST');
    }

    const memberCheck = await prismaClient.member.findFirst({
        where: {
            tenantId: tenantId,
            user: {
                email: request.email,
            },
        },
        select: {
            id: true,
        },
    });

    if (memberCheck) {
        throw new ConflictError('User already become a member in this tenant', 'USER_ALREADY_MEMBER');
    }

    return prismaClient.invitation.create({
        data: {
            email: requestBody.email,
            tenantId: tenantId,
            role: requestBody.role,
            expiresAt: requestBody.expiresAt,

        }, 
        select: {
            id: true,
            email: true,
            tenantId: true,
            role: true,
            expiresAt: true,
        },
    });
};

const getAllMembers = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to get all of the members because of invalid tenant id', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
        },
        select: {
            id: true,
        },
    });

    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const result = await prismaClient.member.findMany({
        where: {
            tenantId: tenantId,
        },
        select: {
            user: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                }
            },
            role: true,
        },
    });

    logger.debug(extractMembers(result));

    return extractMembers(result);
};

export default {
    create,
    getAssociatedTenants,
    getTenantById,
    edit,
    deleteTenant,
    inviteUser,
    getAllMembers,
};