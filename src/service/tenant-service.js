import { prismaClient } from "../application/database.js";
import { logger } from "../application/logging.js";
import { AuthorizationError } from "../error/authorization-error.js";
import { ConflictError } from "../error/conflict-error.js";
import { NotFoundError } from "../error/not-found-error.js";
import { extractMembers, extractTenants } from "../utils/tenantUtils.js";
import { changeMemberRoleValidation, createTenantValidation, handleJoinRequestValidation, inviteUserValidation, joinRequestValidation } from "../validation/tenant-validation.js"
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

const getAllInvitations = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const result = await prismaClient.invitation.findMany({
        where: {
            tenantId: tenantId,
        },
        select: {
            id: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
        },
    });

    return result;
};

const getSpecificInvitationById = async (tenantId, invitationId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const invitation = await prismaClient.invitation.findUnique({
        where: {
            id: invitationId,
            tenantId: tenantId,
        },
        select: {
            id: true,
            email: true,
            tenantId: true,
            role: true,
            createdAt: true,
            expiresAt: true,
            acceptedAt: true,
            status: true,
        },
    });

    if (!invitation) {
        throw new NotFoundError('Failed to do the action because of invitation id is invalid', 'NOT_FOUND_INVITATION');
    }
    return invitation;
};

const deleteInvitation = async (tenantId, invitationId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const invitation = await prismaClient.invitation.findUnique({
        where: {
            id: invitationId,
            tenantId: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!invitation) {
        throw new NotFoundError('Failed to do the action because of invalid invitation id', 'NOT_FOUND_INVITATION');
    }

    await prismaClient.invitation.delete({
        where: {
            id: invitationId,
        },
    });
};

const editMemberRole = async (request, tenantId, targetUserId, user) => {
    const { role } = validate(changeMemberRoleValidation, request);
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const targetMemberData = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: targetUserId,
                tenantId: tenantId,
            },
        },
        select: {
            id: true,
            role: true,
        },
    });
    if (!targetMemberData) {
        throw new NotFoundError('Failed to do the action because of invalid user id', 'NOT_FOUND_USER');
    }
    if ((targetMemberData.role === 'SUPER_ADMIN' || role === 'SUPER_ADMIN') && member.role === 'ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }
    const result = await prismaClient.member.update({
        where: {
            id: targetMemberData.id,
        },
        data: {
            role: role,
        },
        include: {
            user: true,
        }
    });
    return {
        id: result.id,
        username: result.user.username,
        email: result.user.email,
        role: result.role,
    };
};

const deleteMember = async (tenantId, targetUserId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const targetMemberData = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: targetUserId,
                tenantId: tenantId,
            },
        },
        select: {
            id: true,
            role: true,
        },
    });
    if (!targetMemberData) {
        throw new NotFoundError('Failed to do the action because of invalid user id', 'NOT_FOUND_USER');
    }
    if (targetMemberData.role === 'SUPER_ADMIN' && member.role === 'ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }
    await prismaClient.member.delete({
        where: {
            id: targetMemberData.id,
        },
    });
};

const leaveTenant = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Unable to do the action because of invalid tenant id', 'NOT_FOUND_TENANT');
    }

    const memberData = await prismaClient.member.findUnique({
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

    if (!memberData) {
        throw new NotFoundError('Unable to leave the tenant because of not found tenant', 'NOT_FOUND_TENANT');
    }
    await prismaClient.member.delete({
        where: {
            id: memberData.id,
        },
    });
};

const joinTenant = async (request, tenantId, user) => {
    const data = validate(joinRequestValidation, request);
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Unable to do the action because of invalid tenant id', 'NOT_FOUND_TENANT');
    }

    const memberStatus = await prismaClient.member.findUnique({
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

    if (memberStatus) {
        throw new ConflictError("Unable to send the join request because of you already become a member of this tenant", 'ALREADY_MEMBER');
    }

    const requestStatus = await prismaClient.joinRequest.findMany({
        where: {
            tenantId: tenantId,
            userId: user.id,
            status: 'PENDING',
        },
        select: {
            id: true,
        }
    });

    if (requestStatus.length > 0) {
        throw new ConflictError('Unable to send the join request because you already have one', 'JOIN_REQUEST_ALREADY_PENDING');
    }
    data.tenantId = tenantId;
    data.userId = user.id;
    const result = await prismaClient.joinRequest.create({
        data: data,
        select: {
            id: true,
        },
    });

    return result.id;
};  

const getAllJoinRequests = async (tenantId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const result = await prismaClient.joinRequest.findMany({
        where: {
            tenantId: tenantId,
        },
        select: {
            id: true,
            message: true,
            status: true,
            user: {
                select: {
                    id: true,
                    email: true,
                    username: true,
                },
            },
        },
    });

    result.map((request) => {
        request.requestId = request.id;
        request.requestMessage = request.message;
        request.user.userId = request.user.id;
        delete request.id;
        delete request.message;
        delete request.user.id;
        return request;
    });
    return result;
};

const getJoinRequestById = async (tenantId, requestId, user) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const request = await prismaClient.joinRequest.findUnique({
        where: {
            id: requestId,
            tenantId: tenantId,
        },
    });

    if (!request) {
        throw new NotFoundError('Unable to do the action because of invalid request ID', 'NOT_FOUND_JOIN_REQUEST');
    }
    request.requestMessage = request.message;
    request.handledBy = request.handlerUserId;
    delete request.message;
    delete request.handlerUserId;
    return request;
};

const handleJoinRequest = async (request, tenantId, requestId, user) => {
    const { status: responseStatus } =  validate(handleJoinRequestValidation, request);
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to do the action because of invalid Tenant ID', 'NOT_FOUND_TENANT');
    }

    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            }
        },
        select: {
            role: true,
        },
    });
    if (!member) {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'ADMIN' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do this action', 'UNAUTHORIZED_ACTION');
    }

    const requestData = await prismaClient.joinRequest.findUnique({
        where: {
            id: requestId,
            tenantId: tenantId,
        },
        select: {
            id: true,
        },
    });

    if (!requestData) {
        throw new NotFoundError('Unable to do the action because of invalid request ID', 'NOT_FOUND_JOIN_REQUEST');
    }
    const result = await prismaClient.joinRequest.update({
        where: {
            id: requestData.id,
        },
        data: {
            status: responseStatus,
            handledAt: new Date(),
            handlerUserId: user.id,
        },
    });
    if (responseStatus === 'ACCEPTED') {
        const memberStatus = await prismaClient.member.findUnique({
            where: {
                userId_tenantId: {
                    userId: result.userId,
                    tenantId: tenantId,
                },
            },
            select: {
                id: true,
            }
        });

        if (!memberStatus) {
            await prismaClient.member.create({
                data: {
                    userId: result.userId,
                    tenantId: tenantId,
                    role: 'MEMBER',
                },
            });
        }
    }
    result.requestMessage = result.message;
    result.handledBy = result.handlerUserId;
    delete result.id;
    delete result.message;
    delete result.handlerUserId;
    return result;
};

const getAllTenants = async (userId) => {
    return prismaClient.member.findMany({
        where: {
            userId: userId,
        },
        select: {
            tenantId: true,
        },
    });
};

export default {
    create,
    getAssociatedTenants,
    getTenantById,
    edit,
    deleteTenant,
    inviteUser,
    getAllMembers,
    getAllInvitations,
    getSpecificInvitationById,
    deleteInvitation,
    editMemberRole,
    deleteMember,
    leaveTenant,
    joinTenant,
    getAllJoinRequests,
    getJoinRequestById,
    handleJoinRequest,
    getAllTenants
};