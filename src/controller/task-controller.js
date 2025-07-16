import taskService from "../service/task-service";

const create = async (req, res, next) => {
    try {
        // 1. The controller's first job is to parse the HTTP request.
        // It gets the request body, the tenantId from the URL parameters,
        // and the authenticated user object (assuming it's attached by auth middleware).
        const requestBody = req.body;
        const { tenantId } = req.params;
        const user = req.user;

        // 2. It calls the service function, delegating all business logic.
        // The service will handle validation, authorization, and database interaction.
        // It returns a perfectly formatted Data Transfer Object (DTO).
        const result = await taskService.create(requestBody, tenantId, user);

        // 3. The controller's final job is to create the HTTP response envelope.
        // It sets the success status code (201 Created) and wraps the data from the service.
        res.status(201).json({
            success: true,
            data: result
        });

    } catch (error) {
        // 4. If any error is thrown from the service (e.g., NotFoundError),
        // it's passed to the central error-handling middleware.
        next(error);
    }
};

const getTaskById = async (req, res, next) => {
    try {
        // 1. Parse required parameters from the HTTP request.
        const { tenantId, taskId } = req.params;
        const user = req.user; // From auth middleware

        // 2. Delegate the business logic to the service layer.
        // The service returns the perfectly formatted task DTO.
        const result = await taskService.getTaskById(tenantId, taskId, user);

        // 3. Format the successful HTTP response envelope.
        res.status(200).json({
            success: true,
            data: result,
        });

    } catch (error) {
        // 4. Pass any errors (e.g., NotFoundError, AuthorizationError)
        // to the central error-handling middleware.
        next(error);
    }
};

export default {
    create,
    getTaskById,
};