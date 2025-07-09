import { prismaClient } from "../application/database.js";
import { logger } from "../application/logging.js";
import { AuthenticationError } from "../error/authentication-error.js";
import { ConflictError } from "../error/conflict-error.js";
import { generateAccessToken } from "../utils/jwtUtils.js";
import { changePasswordValidation, editCurrentUserInformationValidation, loginValidation, refreshAccessTokenValidation, registerUserValidation } from "../validation/user-validation.js"
import { validate } from "../validation/validation.js"
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthorizationError } from "../error/authorization-error.js";


const register = async (request) => {
    const user = validate(registerUserValidation, request);

    let countUser = await prismaClient.user.count({
        where: {
            username: user.username,
        },
    });

    if (countUser != 0) {
        throw new ConflictError('Username already taken', 'USERNAME_ALREADY_TAKEN');
    }

    countUser = await prismaClient.user.count({
        where: {
            email: user.email,
        },
    });

    if (countUser != 0) {
        throw new ConflictError('Email already used', 'EMAIL_ALREADY_USED');
    }

    user.password = await bcrypt.hash(user.password, 10);
    delete user.confirmationPassword;
    return prismaClient.user.create({
        data: user,
        select: {
            id: true,
            username: true,
            email: true,
        },
    });
};

const login = async (request) => {
    const credential = validate(loginValidation, request);
    const user = await prismaClient.user.findUnique({
        where: {
            username: credential.username,
        }
    });
    if (!user) {
        throw new AuthenticationError("Username and password didn't match", 'INVALID_CREDENTIALS');
    }
    const isPasswordValid = await bcrypt.compare(credential.password, user.password);
    if (!isPasswordValid) {
        throw new AuthenticationError("Username and password didn't match", 'INVALID_CREDENTIALS');
    }
    const accessToken = generateAccessToken(user.id);
    const refreshToken = crypto.randomBytes(128).toString('hex');
    const expires = new Date(Date.now() + 24*60*60*1000*7);
    await prismaClient.token.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: expires,
        }
    });
    return {
        accessToken: accessToken,
        refreshToken: refreshToken,
    };
};

const refreshAccessToken = async (request) => {
    const {refreshToken: token} = validate(refreshAccessTokenValidation, request);
    const oldToken = await prismaClient.token.findUnique({
        where: {
            token: token,
        },
    });
    if (!oldToken) {
        throw new AuthenticationError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    if (!oldToken.valid) {
        throw new AuthenticationError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    await prismaClient.token.update({
        where: {
            token: token,
        },
        data: {
            valid: false,
            usedAt: new Date(),
        },
    });
    const newRefreshToken = crypto.randomBytes(128).toString('hex');
    const expires = new Date(Date.now() + 24*60*60*1000*7);
    await prismaClient.token.create({
        data: {
            token: newRefreshToken,
            userId: oldToken.userId,
            expiresAt: expires,
        }
    });
    const accessToken = generateAccessToken(oldToken.userId);
    logger.debug(accessToken);
    return {
        accessToken: accessToken,
        refreshToken: newRefreshToken,
    };
};

const logout = async (request) => {
    const { refreshToken } = validate(refreshAccessTokenValidation, request);
    const token = await prismaClient.token.findUnique({
        where: {
            token: refreshToken,
        }
    });
    if (!token) {
        throw new AuthenticationError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    if (!token.valid || new Date(token.expiresAt) <= Date.now()) {
        throw new AuthenticationError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    await prismaClient.token.update({
        where: {
            token: refreshToken
        },
        data: {
            valid: false,
            usedAt: new Date(),
        },
    });
};

const getCurrentUserInformation = (user) => {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
    };
};

const editCurrentUserInformation = async (request, user) => {
    const newUserInformation = validate(editCurrentUserInformationValidation, request);
    const informationToDB = {};
    if (newUserInformation.username) {
        const countUser = await prismaClient.user.count({
            where: {
                username: newUserInformation.username,
            },
        });
        if (countUser > 0) {
            throw new ConflictError('Failed to edit user information, username already taken', 'USERNAME_ALREADY_TAKEN');
        }
        informationToDB.username = newUserInformation.username;
    }
    if (newUserInformation.email) {
        const countUser = await prismaClient.user.count({
            where: {
                email: newUserInformation.email
            },
        });
        if (countUser > 0) {
            throw new ConflictError('Failed to edit user information, email already taken', 'EMAIL_ALREADY_TAKEN');
        }
        informationToDB.email = newUserInformation.email;
    }
    const result = await prismaClient.user.update({
        where: {
            id: user.id,
        },
        data: informationToDB,
    });
    // logger.debug(result);
    return {
        id: result.id,
        username: result.username,
        email: result.email,
    };
};

const deleteUser = async (user) => {
    await prismaClient.user.delete({
        where: {
            id: user.id,
        },
    });
};

const changePassword = async (request, user) => {
    const passwordInformation = validate(changePasswordValidation, request);
    const isPasswordValid = await bcrypt.compare(passwordInformation.oldPassword, user.password);
    if (!isPasswordValid) {
        throw new AuthorizationError('Old Password is not valid', 'INVALID_PASSWORD');
    }
    const newHashedPassword = await bcrypt.hash(passwordInformation.newPassword, 10);
    await prismaClient.user.update({
        where: {
            id: user.id,
        },
        data: {
            password: newHashedPassword,
        },
    });
    await prismaClient.token.updateMany({
        where: {
            userId: user.id,
        },
        data: {
            valid: false,
            usedAt: new Date(),
        },
    });
};

export default {
    register,
    login,
    refreshAccessToken,
    logout,
    getCurrentUserInformation,
    editCurrentUserInformation,
    deleteUser,
    changePassword,
};