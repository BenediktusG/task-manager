import { createTaskValidation } from "../validation/task-validation";
import { prismaClient } from "../application/database";
import { NotFoundError } from "../error/not-found-error";
import { AuthorizationError } from "../error/authorization-error";
import { validate } from "../validation/validation";
import { BadRequestError } from "../error/bad-request-error";


/**
 * Maps the public-facing status from the request to the internal Prisma enum.
 * @param {string} status - The status from the request body ('todo', 'inProgress', 'done').
 * @returns {string} The corresponding Prisma TaskStatus enum ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').
 */
const mapStatusToPrismaEnum = (status) => {
    const statusMap = {
        todo: 'NOT_STARTED',
        inProgress: 'IN_PROGRESS',
        done: 'COMPLETED',
    };
    // Return the mapped status, or the default if the input is undefined or invalid.
    return status ? statusMap[status] : 'NOT_STARTED';
};

/**
 * Maps the internal Prisma enum for status back to the public-facing string.
 * @param {string} prismaStatus - The TaskStatus enum from Prisma ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').
 * @returns {string} The corresponding public-facing status string ('todo', 'inProgress', 'done').
 */
const mapPrismaEnumToStatus = (prismaStatus) => {
    const statusMap = {
        NOT_STARTED: 'todo',
        IN_PROGRESS: 'inProgress',
        COMPLETED: 'done',
    };
    return statusMap[prismaStatus];
};


/**
 * Service function to create a new task within a tenant.
 *
 * @param {object} request - The request body containing task details.
 * @param {string} tenantId - The UUID of the tenant where the task will be created.
 * @param {object} user - The authenticated user object, who will be the task creator.
 * @returns {Promise<object>} The newly created task object.
 */
const create = async (request, tenantId, user) => {
    // 1. Validate the incoming request body against the Joi schema.
    const validatedRequest = validate(createTaskValidation, request);

    // 2. Verify that the tenant exists.
    const tenant = await prismaClient.tenant.findUnique({
        where: {
            id: tenantId
        },
        select: {
            id: true
        },
    });

    if (!tenant) {
        throw new NotFoundError('Failed to create task: Tenant not found.', 'NOT_FOUND_TENANT');
    }

    // 3. Verify that the user creating the task is an admin or super admin.
    const creatorIsMember = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
        },
        select: {
            role: true,
        },
    });

    if (!creatorIsMember) {
        throw new AuthorizationError('You are not authorized to create tasks in this tenant.', 'UNAUTHORIZED_ACTION');
    }

    if (creatorIsMember.role !== 'MANAGER' && creatorIsMember.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to create tasks in this tenant.', 'UNAUTHORIZED_ACTION');
    }
    // 4. Verify that all users being assigned the task are also members of the tenant.
    const {
        assignedTo
    } = validatedRequest;
    if (assignedTo && assignedTo.length > 0) {
        const memberCount = await prismaClient.member.count({
            where: {
                tenantId: tenantId,
                userId: { in: assignedTo
                },
            },
        });

        if (memberCount !== assignedTo.length) {
            throw new BadRequestError('Failed to create task: One or more assigned users are not members of this tenant.', 'INVALID_ASSIGNEES');
        }
    }

    // 5. Create the task and its assignments in a single transaction.
    const result = await prismaClient.task.create({
        data: {
            title: validatedRequest.title,
            description: validatedRequest.description,
            due: validatedRequest.due,
            priority: validatedRequest.priority,
            progress: validatedRequest.progress,
            status: mapStatusToPrismaEnum(validatedRequest.status),
            tenantId: tenantId,
            creatorId: user.id,
            assignedUsers: {
                create: assignedTo.map((userId) => ({
                    userId: userId,
                })),
            },
        },
        select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            progress: true,
            status: true,
            createdAt: true,
            creatorId: true,
            due: true,
            assignedUsers: {
                select: {
                    userId: true,
                },
            },
        },
    });

    // 6. Format the response to exactly match the required output.
    const finalResponse = {
        ...result,
        // Map the status enum back to the client-facing string
        status: mapPrismaEnumToStatus(result.status),
        createdBy: result.creatorId,
        // Transform the assignedUsers array from [{ userId: '...' }] to ['...']
        assignedTo: result.assignedUsers.map(assignment => assignment.userId),
    };
    delete finalResponse.creatorId;

    // Clean up the original nested object
    delete finalResponse.assignedUsers;

    return finalResponse;
};

export default {
    create,
};