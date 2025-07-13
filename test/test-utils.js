import { faker } from "@faker-js/faker"
import { prismaClient } from "../src/application/database.js";
import supertest from "supertest";
import bcrypt from 'bcrypt';
import { web } from "../src/application/web.js";

const generateKey = () => {
    return faker.string.alpha({length: 4, casing: 'mixed'});
};

const removeAllUsers = async (key) => {
    await prismaClient.user.deleteMany({
        where: {
            username: {
                startsWith: key,
            },
        },
    });
};

const generateUserInformation = (key) => {
    const password = faker.internet.password() + '@11';
    return {
        username: key + faker.person.firstName(),
        email: key + faker.internet.email(),
        password: password,
        confirmationPassword: password,
    };
};

const createUser = async (key) => {
    const userInformation = generateUserInformation(key);
    delete userInformation.confirmationPassword;
    const plainPassword = userInformation.password;
    userInformation.password = await bcrypt.hash(plainPassword, 10);
    const result = await prismaClient.user.create({
        data: userInformation,
    });
    result.password = plainPassword;
    
    const result2 = await supertest(web)
        .post('/auth/login')
        .send({
            username: result.username,
            password: result.password,
        });
    
    result.accessToken = result2.body.data.accessToken;
    result.refreshToken = result2.body.data.refreshToken;
    return result;
};

const checkRefreshToken = async (refreshToken) => {
    const token = await prismaClient.token.findUnique({
        where: {
            token: refreshToken,
        },
    });
    if (!token) {
        return false;
    }
    return token.valid;
};

const removeAllTenants = async (key) => {
    await prismaClient.tenant.deleteMany({
        where: {
            name: {
                startsWith: key,
            }
        },
    });
};

const removeAllData = async (key) => {
    await removeAllTenants(key);
    await removeAllUsers(key);
};

const generateTenantInformation = (key) => {
    return {
        name: key + faker.company.name().slice(0, 16),
        description: faker.lorem.word({ length: { max: 500 } }),
    };
};

const createTenant = async (key) => {
    const tenantInformation = generateTenantInformation(key);
    return prismaClient.tenant.create({
        data: tenantInformation,
    });
};

const joinTenant = async (userId, tenantId, role='MEMBER') => {
    return prismaClient.member.create({
        data: {
            userId: userId,
            tenantId: tenantId,
            role: role,
        },
    });
};

const checkTenant = async (tenantId) => {
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId,
        },
    });
    if (!tenant) {
        return false;
    } else {
        return true;
    }
};

const cleanUserData = (user) => {
    delete user.password;
    delete user.accessToken;
    delete user.refreshToken;
};

const createInvitation = async (tenantId, key, role='MEMBER') => {
    const user = generateUserInformation(key);
    const invitation = await prismaClient.invitation.create({
        data: {
            email: user.email,
            tenantId: tenantId,
            role: role,
            expiresAt: new Date(new Date() + 14*24*60*60*1000),
        },
    });
    invitation.expiresAt = invitation.expiresAt.toISOString();
    if (invitation.acceptedAt) {
        invitation.acceptedAt = invitation.acceptedAt.toISOString();
    }
    invitation.createdAt = invitation.createdAt.toISOString();
    return invitation;
};

const checkInvitation = async (invitationId) => {
    const result = await prismaClient.invitation.findUnique({
        where: {
            id: invitationId,
        },
        select: {
            id: true,
        },
    });

    if (!result) {
        return false;
    }
    return true;
};

const checkMember = async (userId, tenantId) => {
    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: userId,
                tenantId: tenantId,
            },
        },
        select: {
            id: true,
        },
    });

    if (member) {
        return true;
    }
    return false;
}

const createInvitationUsingEmail = async (tenantId, email, role='MEMBER') => {
    const invitation = await prismaClient.invitation.create({
        data: {
            email: email,
            tenantId: tenantId,
            role: role,
            expiresAt: new Date(new Date() + 14*24*60*60*1000),
        },
    });
    invitation.expiresAt = invitation.expiresAt.toISOString();
    if (invitation.acceptedAt) {
        invitation.acceptedAt = invitation.acceptedAt.toISOString();
    }
    invitation.createdAt = invitation.createdAt.toISOString();
    return invitation;
};

const checkJoinRequest = async (requestId) => {
    const joinRequest = await prismaClient.joinRequest.findUnique({
        where: {
            id: requestId,
        },
        select: {
            id: true,
        },
    });
    if (!joinRequest) {
        return false;
    }
    return true;
};

const sendJoinRequest = async (userId, tenantId) => {
    const result = await prismaClient.joinRequest.create({
        data: {
            userId: userId,
            tenantId: tenantId,
        },
        include: {
            user: true,
        },
    });

    result.createdAt = result.createdAt.toISOString();
    if (result.handledAt) {
        result.handledAt = result.handledAt.toISOString();
    }

    return result;
};

export {
    generateKey,
    removeAllUsers,
    generateUserInformation,
    createUser,
    checkRefreshToken,
    removeAllTenants,
    removeAllData,
    generateTenantInformation,
    createTenant,
    joinTenant,
    checkTenant,
    cleanUserData,
    createInvitation,
    checkInvitation,
    checkMember,
    createInvitationUsingEmail,
    checkJoinRequest,
    sendJoinRequest,
};