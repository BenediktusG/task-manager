import userService from "../service/user-service.js"

const register = async (req, res, next) => {
    try {
        const result = await userService.register(req.body);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const login = async (req, res, next) => {
    try {
        const result = await userService.login(req.body);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const refreshAccessToken = async (req, res, next) => {
    try {
        const result = await userService.refreshAccessToken(req.body);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const logout = async (req, res, next) => {
    try {
        await userService.logout(req.body);
        res.status(200).json({
            success: true,
            data: {
                message: 'Logout successfully',
            },
        });
    } catch (e) {
        next(e);
    }
};

const getCurrentUserInformation = async (req, res) => {
    // logger.debug(req.user);
    const result = userService.getCurrentUserInformation(req.user);
    res.status(200).json({
        success: true,
        data: result,
    });
};

const editCurrentUserInformation = async (req, res, next) => {
    try {
        const result = await userService.editCurrentUserInformation(req.body, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const deleteUser = async (req, res) => {
    await userService.deleteUser(req.user);
    res.status(200).json({
        success: true,
        data: {
            message: 'Your account has been deleted successfully',
        },
    });
};

const changePassword = async (req, res, next) => {
    try {
        await userService.changePassword(req.body, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: 'Your password has been changed successfully',
            },
        });
    } catch (e) {
        next(e);
    }
};

const getAllInvitations = async (req, res) => {
    const result = await userService.getAllInvitations(req.user);
    res.status(200).json({
        success: true,
        data: result,
    });
};

const getInvitationById = async (req, res, next) => {
    try {
        const result = await userService.getInvitationById(req.params.invitationId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const acceptInvitation = async (req, res, next) => {
    try {
        await userService.acceptInvitation(req.params.invitationId, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: 'Success accept an invitation',
            },
        });
    } catch (e) {
        next(e);
    }
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
    getAllInvitations,
    getInvitationById,
    acceptInvitation,
};