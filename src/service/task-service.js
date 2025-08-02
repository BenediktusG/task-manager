import { createTaskValidation } from "../validation/task-validation.js";
import { prismaClient } from "../application/database.js";
import { NotFoundError } from "../error/not-found-error.js";
import { AuthorizationError } from "../error/authorization-error.js";
import { validate } from "../validation/validation.js";
import { BadRequestError } from "../error/bad-request-error.js";
import { mapStatusToPrismaEnum, mapPrismaEnumToStatus, compareArrayWithoutOrder } from "../utils/taskUtils.js";
import taskNotification from "./task-notification.js";

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

    taskNotification.emitTaskCreated({
        taskId: result.id,
        tenantId: result.tenantId,
        title: result.title,
        description: result.description,
        createdAt: result.createdAt,
        createdBy: result.creatorId,
    });

    result.assignedUsers.forEach( userId => {
        taskNotification.emitTaskAssigned({
            taskId: result.id,
            tenantId: result.tenantId,
            assignedUserId: userId,
            assignedAt: result.createdAt,
        });
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

const getTaskById = async (tenantId, taskId, user) => {
    // 1. Authorization: Verify the user is a member of the tenant.
    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
        },
    });

    if (!member) {
        throw new AuthorizationError('You are not authorized to access this resource', 'UNAUTHORIZED_ACTION');
    }

    // 2. Database Query: Fetch the task, ensuring it belongs to the correct tenant.
    // This is a critical security check to prevent IDOR vulnerabilities.
    const task = await prismaClient.task.findUnique({
        where: {
            id: taskId,
            tenantId: tenantId, // Ensures the task is within the scoped tenant
        },
        select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            progress: true,
            status: true,
            tenantId: true,
            creatorId: true, // Will be renamed to 'createdBy'
            createdAt: true,
            updatedAt: true,
            due: true,
            assignedUsers: { // Fetch the assigned users' details
                select: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });

    // 3. Not Found Check: If no task is returned, throw an error.
    if (!task) {
        throw new NotFoundError('Task not found', 'NOT_FOUND_TASK');
    }

    // 4. Data Formatting: Transform the database result into the API response shape.
    const formattedTask = {
        ...task,
        status: mapPrismaEnumToStatus(task.status),
        createdBy: task.creatorId, // Rename for the final response
        assignedTo: task.assignedUsers.map(assignment => ({
            userId: assignment.user.id,
            username: assignment.user.username,
            email: assignment.user.email,
        })),
    };

    // Clean up the original properties that were transformed or renamed
    delete formattedTask.creatorId;
    delete formattedTask.assignedUsers;

    return formattedTask;
};

const getAllTasks = async (tenantId, user) => {
    // 1. Authorization: Verify the user is a member of the tenant.
    // This is a crucial step to ensure users can only see tasks from their own tenants.
    const member = await prismaClient.member.findUnique({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: tenantId,
            },
        },
        select: {
            id: true
        }, // We only need to check for existence.
    });

    if (!member) {
        throw new AuthorizationError('You are not authorized to access this resource', 'UNAUTHORIZED_ACTION');
    }

    // 2. Database Query: Fetch all tasks that belong to the specified tenant.
    const tasks = await prismaClient.task.findMany({
        where: {
            tenantId: tenantId,
        },
        // Use a 'select' clause to fetch only the fields required by the API documentation.
        // This makes the query lightweight and efficient.
        select: {
            id: true,
            title: true,
            priority: true,
            progress: true,
        },
        orderBy: {
            createdAt: 'desc', // Optional: Order tasks by most recently created.
        },
    });

    // 3. Format the final response object to match the documentation.
    return {
        tasks: tasks,
    };
};

const editTask = async (request, tenantId, taskId, user) => {
    const validatedRequest = validate(createTaskValidation, request);
    const task = await prismaClient.task.findUnique({
        where: {
            tenantId: tenantId,
            id: taskId,
        },
        include: {
            assignedUsers: {
                select: {
                    userId: true,
                }
            }
        },  
    });
    if (!task) {
        throw new NotFoundError('Task not found', 'NOT_FOUND_TASK');
    }
    const member = await prismaClient.member.findUnique({
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
    if (!member) {
        throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
    }
    let assignedTo;
    if (task.assignedUsers) {
        assignedTo = task.assignedUsers.map((data) => data.userId);
    }
    if (member.role !== 'MANAGER' && member.role !== 'SUPER_ADMIN') {
        if (task.assignedUsers) {
            if (task.assignedUsers.some((data) => data.userId === user.id)) {
                if (validatedRequest.title !== task.title || validatedRequest.description !== task.description || validatedRequest.due.toISOString() !== task.due.toISOString()) {
                    throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
                }
                if (!compareArrayWithoutOrder(assignedTo, validatedRequest.assignedTo)) {
                    throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
                }
            } else {
                throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
            }
        } else {
           throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
        }
    }
    const prismaData = {...validatedRequest};
    if (prismaData.status) {
        prismaData.status = mapStatusToPrismaEnum(validatedRequest.status);
    }
    delete prismaData.assignedTo;
    const assignedToObject = {};
    const deletedUser = [];
    const addedUser = [];
    if (validatedRequest.assignedTo) {
        for (let item of validatedRequest.assignedTo) {
            assignedToObject[item] = 1;
        }
    }
    if (assignedTo) {
        for (let item of assignedTo) {
            if (!assignedToObject[item]) {
                assignedToObject[item] = 0;
            }
            assignedToObject[item]--;
        }
    }
    for (let key in assignedToObject) {
        if (assignedToObject[key] == -1) {
            deletedUser.push(key);
        } else if (assignedToObject[key] == 1) {
            addedUser.push({
                userId: key,
                tenantId: tenantId,
            });
        }
    }
    await prismaClient.taskAssigment.createMany({
        data: addedUser,
    });

    addedUser.forEach(addedUserId => {
        taskNotification.emitTaskAssigned({
            taskId: taskId,
            tenantId: tenantId,
            assignedUserId: addedUserId,
            assignedAt: new Date(),
        });
    });

    await prismaClient.taskAssigment.deleteMany({
        where: {
            userId: {
                in: deletedUser,
            },
            taskId: taskId,
        },
    });
    const result = await prismaClient.task.update({
        where: {
            id: taskId,
        },
        data: prismaData,
        include: {
            assignedUsers: {
                select: {
                    userId: true,
                    user: {
                        select: {
                            username: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });

    taskNotification.emitTaskUpdated({
        taskId: result.id,
        tenantId: result.tenantId,
        title: result.title,
        description: result.description,
        createdAt: result.createdAt,
        createdBy: result.creatorId,
    });

    const resultAssignedTo = result.assignedUsers.map((data) => {
        const newData = {
            ...data,
            ...data.user,
        };
        delete newData.user;
        return newData;
    });
    const formattedResult = {
        ...result,
        assignedTo: resultAssignedTo,
    };
    if (formattedResult.status) {
        formattedResult.status = mapPrismaEnumToStatus(formattedResult.status);
    }
    delete formattedResult.assignedUsers;
    return formattedResult;
};

const deleteTask = async (tenantId, taskId, user) => {
    const task = await prismaClient.task.findUnique({
        where: {
            tenantId: tenantId,
            id: taskId,
        },
        include: {
            assignedUsers: {
                select: {
                    userId: true,
                }
            }
        },  
    });
    if (!task) {
        throw new NotFoundError('Task not found', 'NOT_FOUND_TASK');
    }
    const member = await prismaClient.member.findUnique({
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
    if (!member) {
        throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
    }

    if (member.role !== 'MANAGER' && member.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('You are not authorized to do the action', 'UNAUTHORIZED_ACTION');
    }

    const result = await prismaClient.task.delete({
        where: {
            id: taskId,
        },
    });
    
    taskNotification.emitTaskDeleted({
        taskId: result.id,
        tenantId: result.tenantId,
        deletedAt: new Date(),
        deletedBy: user.id,
    });
};

export default {
    create,
    getTaskById,
    getAllTasks,
    editTask,
    deleteTask,
};