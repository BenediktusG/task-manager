import { createTask, createTenant, createUser, generateKey, getTaskById, joinTenant, removeAllData } from "./test-utils";
import supertest from "supertest";
import { web } from "../src/application/web";
import { faker } from "@faker-js/faker";

describe('POST /tenants/:tenantId/tasks', () => {
    let key;
    let managerUser; // Changed name for clarity
    let memberUser; // Changed name for clarity
    let tenant;

    beforeEach(async () => {
        key = generateKey();
        managerUser = await createUser(key); // This user will have manager permissions
        memberUser = await createUser(key); // This user will be a regular member
        tenant = await createTenant(key);

        // Join users to the tenant with specific roles
        await joinTenant(managerUser.id, tenant.id, 'MANAGER');
        await joinTenant(memberUser.id, tenant.id, 'MEMBER');
    });

    afterEach(async () => {
        await removeAllData(key);
    });

    test('should create a new task successfully with status 201 when user is a MANAGER', async () => {
        const taskData = {
            title: 'Monthly Financial Report',
            description: 'Compile and submit the financial report for the previous month.',
            priority: 3,
            progress: 10,
            status: 'todo',
            assignedTo: [memberUser.id],
            due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${managerUser.accessToken}`)
            .send(taskData);
        

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            success: true,
            data: expect.any(Object),
        });
        expect(response.body.data).toEqual(expect.objectContaining({
            id: expect.any(String),
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            progress: taskData.progress,
            status: taskData.status,
            assignedTo: taskData.assignedTo,
            createdBy: managerUser.id,
            createdAt: expect.any(String),
            due: taskData.due,
        }));

        // Verify in database
        const createdTask = await getTaskById(response.body.data.id);
        expect(createdTask).toBeDefined();
        expect(createdTask.creatorId).toBe(managerUser.id);
    });

    test('should create a new task successfully with status 201 when user is a SUPER_ADMIN', async () => {
        const superAdminUser = await createUser(key);
        await joinTenant(superAdminUser.id, tenant.id, 'SUPER_ADMIN');

        const taskData = {
            title: 'Q4 Strategic Planning',
            description: 'Finalize the strategic plan for the fourth quarter.',
            assignedTo: [memberUser.id],
            due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${superAdminUser.accessToken}`)
            .send(taskData);

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            success: true,
            data: expect.any(Object),
        });
        
        expect(response.body.data).toEqual(expect.objectContaining({
            id: expect.any(String),
            title: taskData.title,
            description: taskData.description,
            status: 'todo',
            assignedTo: taskData.assignedTo,
            createdBy: superAdminUser.id,
            createdAt: expect.any(String),
            due: taskData.due,
        }));

        const createdTask = await getTaskById(response.body.data.id);
        expect(createdTask).toBeDefined();
        expect(createdTask.creatorId).toBe(superAdminUser.id);
    });


    test('should fail with status 403 when user has MEMBER role', async () => {
        // memberUser is already created in beforeEach with MEMBER role
        const taskData = {
            title: 'Member Task Attempt',
            description: 'This should not be created.',
            assignedTo: [managerUser.id],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`)
            .send(taskData);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(response.body.error.message.length).toBeGreaterThan(0);
    });

    test('should fail with status 403 when user has ADMIN role', async () => {
        const adminUser = await createUser(key);
        await joinTenant(adminUser.id, tenant.id, 'ADMIN');

        const taskData = {
            title: 'Admin Task Attempt',
            description: 'This should not be created either.',
            assignedTo: [memberUser.id],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${adminUser.accessToken}`)
            .send(taskData);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(response.body.error.message.length).toBeGreaterThan(0);
    });


    test('should fail with status 400 for invalid request body (missing title)', async () => {
        const taskData = {
            description: 'A task without a title.',
            assignedTo: [memberUser.id],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${managerUser.accessToken}`)
            .send(taskData);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(response.body.error.details[0].field).toBe('title');
    });

    test('should fail with status 400 when assigning to a user who is not a tenant member', async () => {
        const nonMemberUser = await createUser(key);

        const taskData = {
            title: 'Top Secret Task',
            description: 'This task is for non-members.',
            assignedTo: [nonMemberUser.id],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${managerUser.accessToken}`)
            .send(taskData);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ASSIGNEES',
                message: expect.any(String),
            },
        });
    });


    test('should fail with status 401 for missing access token', async () => {
        const taskData = {
            title: 'Attempted Task',
            description: 'This should not be created.',
            assignedTo: [],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .send(taskData);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
    });
    
    test('should fail with status 401 when access token is invalid', async () => {
        const taskData = {
            title: 'Attempted Task',
            description: 'This should not be created.',
            assignedTo: [],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', 'Bearer invalid-token')
            .send(taskData);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
    });

    test('should fail with status 403 when user is not a member of the tenant', async () => {
        const outsiderUser = await createUser(key);

        const taskData = {
            title: 'Outsider Task',
            description: 'This should not be created.',
            assignedTo: [],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${outsiderUser.accessToken}`)
            .send(taskData);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
    });

    test('should fail with status 404 for non-existent tenant ID', async () => {
        const fakeTenantId = faker.string.uuid();
        const taskData = {
            title: 'Task for Ghost Tenant',
            description: 'This should not be created.',
            assignedTo: [],
            due: new Date().toISOString(),
        };

        const response = await supertest(web)
            .post(`/tenants/${fakeTenantId}/tasks`)
            .set('Authorization', `Bearer ${managerUser.accessToken}`)
            .send(taskData);
        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
    });
});


describe('GET /tenants/:tenantId/tasks/:taskId', () => {
    let key;
    let managerUser, memberUser; // Renamed for clarity
    let tenant;
    let task;

    beforeEach(async () => {
        key = generateKey();
        managerUser = await createUser(key); // This user can create tasks
        memberUser = await createUser(key); // This user will be assigned the task
        tenant = await createTenant(key);

        // Assign correct roles
        await joinTenant(managerUser.id, tenant.id, 'MANAGER');
        await joinTenant(memberUser.id, tenant.id, 'MEMBER');

        // Create a task using a user with the correct permissions
        task = await createTask(tenant.id, managerUser.id, [memberUser.id]);
    });

    afterEach(async () => {
        await removeAllData(key);
    });

    test('should get a task successfully with status 200', async () => {
        // The user making the request can be any member of the tenant
        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks/${task.id}`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: expect.any(Object),
        });

        // Verify the response against the API contract
        expect(response.body.data).toEqual({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            progress: task.progress,
            status: 'todo', // Default status mapped
            tenantId: tenant.id,
            createdBy: managerUser.id, // Verify it was created by the manager
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            due: task.due.toISOString(),
            assignedTo: [{
                userId: memberUser.id,
                username: memberUser.username,
                email: memberUser.email,
            }, ],
        });
    });

    test('should fail with status 401 for missing access token', async () => {
        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks/${task.id}`);
        // No Authorization header

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
    });

    test('should fail with status 403 when user is not a member of the tenant', async () => {
        const outsiderUser = await createUser(key); // This user is not in the tenant

        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks/${task.id}`)
            .set('Authorization', `Bearer ${outsiderUser.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: 'You are not authorized to access this resource',
            },
        });
    });

    test('should fail with status 404 for a non-existent task ID', async () => {
        const fakeTaskId = faker.string.uuid();

        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks/${fakeTaskId}`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TASK',
                message: 'Task not found',
            },
        });
    });

    test('should fail with status 403 for a non-existent tenant ID', async () => {
        // Note: This will result in a 403 because the auth check (is member?) fails first.
        const fakeTenantId = faker.string.uuid();

        const response = await supertest(web)
            .get(`/tenants/${fakeTenantId}/tasks/${task.id}`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('UNAUTHORIZED_ACTION');
    });
});

describe('GET /tenants/:tenantId/tasks', () => {
    let key;
    let managerUser; // User with permission to create tasks
    let memberUser; // User with permission to view tasks
    let tenant;
    let task1, task2;

    beforeEach(async () => {
        key = generateKey();
        managerUser = await createUser(key);
        memberUser = await createUser(key);
        tenant = await createTenant(key);

        // Assign correct roles
        await joinTenant(managerUser.id, tenant.id, 'MANAGER');
        await joinTenant(memberUser.id, tenant.id, 'MEMBER');

        // Create tasks using a user with the correct permissions (manager)
        task1 = await createTask(tenant.id, managerUser.id, [], {
            title: 'First Task',
            priority: 1,
            progress: 10
        });
        task2 = await createTask(tenant.id, managerUser.id, [], {
            title: 'Second Task',
            priority: 5,
            progress: 50
        });
    });

    afterEach(async () => {
        await removeAllData(key);
    });

    test('should get all tasks successfully with status 200', async () => {
        // A regular member can view the tasks
        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: {
                tasks: expect.arrayContaining([
                    expect.objectContaining({
                        id: task1.id,
                        title: task1.title,
                        priority: task1.priority,
                        progress: task1.progress,
                    }),
                    expect.objectContaining({
                        id: task2.id,
                        title: task2.title,
                        priority: task2.priority,
                        progress: task2.progress,
                    }),
                ]),
            },
        });
        // Also check the length to ensure no extra tasks are returned
        expect(response.body.data.tasks).toHaveLength(2);
    });

    test('should return an empty array if tenant has no tasks', async () => {
        // Create a new tenant with a member but no tasks
        const emptyTenant = await createTenant(key);
        const newUser = await createUser(key);
        await joinTenant(newUser.id, emptyTenant.id, 'MEMBER');

        const response = await supertest(web)
            .get(`/tenants/${emptyTenant.id}/tasks`)
            .set('Authorization', `Bearer ${newUser.accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            data: {
                tasks: [],
            },
        });
    });

    test('should fail with status 401 for missing access token', async () => {
        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
    });

    test('should fail with status 403 when user is not a member of the tenant', async () => {
        const outsiderUser = await createUser(key);

        const response = await supertest(web)
            .get(`/tenants/${tenant.id}/tasks`)
            .set('Authorization', `Bearer ${outsiderUser.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: 'You are not authorized to access this resource',
            },
        });
    });

    test('should fail with status 403 for a non-existent tenant ID', async () => {
        const fakeTenantId = faker.string.uuid();

        const response = await supertest(web)
            .get(`/tenants/${fakeTenantId}/tasks`)
            .set('Authorization', `Bearer ${memberUser.accessToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: 'You are not authorized to access this resource',
            },
        });
    });
});
