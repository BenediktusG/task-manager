import tenantService from "../service/tenant-service.js"

const create = async(req, res, next) => {
    try {
        const result = await tenantService.create(req.body, req.user);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getAssociatedTenants = async (req, res) => {
    const result = await tenantService.getAssociatedTenants(req.user);
    res.status(200).json({
        success: true,
        data: {
            tenants: result,
        },
    });
};

const getTenantById = async (req, res, next) => {
    try {
        const result = await tenantService.getTenantById(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const edit = async (req, res, next) => {
    try {
        const result = await tenantService.edit(req.body, req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const deleteTenant = async (req, res, next) => {
    try {
        await tenantService.deleteTenant(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: 'Tenant deleted successfully',
            },
        });
    } catch (e) {
        next(e);
    }
};

const inviteUser = async (req, res, next) => {
    try {
        const result = await tenantService.inviteUser(req.body, req.params.tenantId, req.user);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getAllMembers = async (req, res, next) => {
    try {
        const result = await tenantService.getAllMembers(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getAllInvitations = async (req, res, next) => {
    try {
        const result = await tenantService.getAllInvitations(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getSpecificInvitationById = async (req, res, next) => {
    try {
        const result = await tenantService.getSpecificInvitationById(req.params.tenantId, req.params.invitationId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const deleteInvitation = async (req, res, next) => {
    try {
        await tenantService.deleteInvitation(req.params.tenantId, req.params.invitationId, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: "successfully deleted an invitation",
            },
        });
    } catch (e) {
        next(e);
    }
};

const editMemberRole = async (req, res, next) => {
    try {
        const result = await tenantService.editMemberRole(req.body, req.params.tenantId, req.params.userId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const deleteMember = async (req, res, next) => {
    try {
        await tenantService.deleteMember(req.params.tenantId, req.params.userId, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: 'Successfully deleted the user from the tenant',
            },
        });
    } catch (e) {
        next(e);
    }
};

const leaveTenant = async (req, res, next) => {
    try {
        await tenantService.leaveTenant(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: {
                message: "successfully leave the tenant",
            },
        });
    } catch (e) {
        next(e);
    }
};

const joinTenant = async (req, res, next) => {
    try {
        const requestId = await tenantService.joinTenant(req.body, req.params.tenantId, req.user);
        res.status(201).json({
            success: true,
            data: {
                requestId: requestId,
            },
        });
    } catch (e) {
        next(e);
    }
};

const getAllJoinRequests = async (req, res, next) => {
    try {
        const result = await tenantService.getAllJoinRequests(req.params.tenantId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getJoinRequestById = async (req, res, next) => {
    try {
        const result = await tenantService.getJoinRequestById(req.params.tenantId, req.params.requestId, req.user);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (e) {
        next(e);
    }
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
};