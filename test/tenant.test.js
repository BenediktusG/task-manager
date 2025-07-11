import supertest from "supertest";
import { checkInvitation, checkTenant, cleanUserData, createInvitation, createTenant, createUser, generateKey, generateTenantInformation, generateUserInformation, joinTenant, removeAllData } from "./test-utils.js";
import { web } from "../src/application/web.js";
import { logger } from "../src/application/logging.js";

describe('POST /tenants', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 OK when a tenant successfully created with description', async () => {
        const tenantInformation = generateTenantInformation(key);
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/tenants')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send(tenantInformation);
        logger.debug(result.body);
        expect(result.status).toBe(201);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: expect.any(String),
                name: tenantInformation.name,
                description: tenantInformation.description,
            }
        });
        expect(result.body.data.id.length).toBeGreaterThan(0);
    });

    it('should return 200 OK when a tenant successfully created without description', async () => {
        const tenantInformation = generateTenantInformation(key);
        delete tenantInformation.description;
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/tenants')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send(tenantInformation);
        logger.debug(result.body);
        expect(result.status).toBe(201);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: expect.any(String),
                name: tenantInformation.name,
            }
        });
        expect(result.body.data.id.length).toBeGreaterThan(0);
    });

    it('should return 400 bad request when request body is missing', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/tenants')
            .set('Authorization', 'Bearer ' + userInformation.accessToken);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            }
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
        expect(result.body.error.details[0].field.length).toBeGreaterThan(0);
        expect(result.body.error.details[0].message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const tenantInformation = generateTenantInformation(key);
        const result = await supertest(web)
            .post('/tenants')
            .send(tenantInformation);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenantInformation = generateTenantInformation(key);
        const result = await supertest(web)
            .post('/tenants')
            .set('Authorization', 'Bearer Salah')
            .send(tenantInformation);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 409 conflict when the tenant name already exists', async () => {
        const tenantInformation = await createTenant(key);
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/tenants')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                name: tenantInformation.name,
            });
        logger.debug(result.body);
        expect(result.status).toBe(409);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'TENANT_NAME_ALREADY_TAKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /tenants', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 OK when the user has no associated tenant yet', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .get('/tenants')
            .set('Authorization', 'Bearer ' + user.accessToken);
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                tenants: [],
            },
        });
    });

    it('should return 200 OK when the user has several associated tenants', async () => {
        const user = await createUser(key);
        const tenant1 = await createTenant(key);
        const tenant2 = await createTenant(key);
        const tenant3 = await createTenant(key);
        const tenant4 = await createTenant(key);
        const tenant5 = await createTenant(key);
        const tenant6 = await createTenant(key);
        await joinTenant(user.id, tenant1.id, 'ADMIN');
        await joinTenant(user.id, tenant2.id, 'SUPER_ADMIN');
        await joinTenant(user.id, tenant3.id, 'MANAGER');
        await joinTenant(user.id, tenant4.id);

        const result = await supertest(web)
            .get('/tenants')
            .set('Authorization', 'Bearer ' + user.accessToken);
        expect(result.status).toBe(200);
        logger.debug(result.body);
        expect(result.body).toEqual({
            success: true,
            data: {
                tenants: expect.any(Object),
            },
        });
        const { tenants } = result.body.data;
        expect(tenants.length).toBe(4);
        expect(tenants.includes({
            id: tenant1.id,
            name: tenant1.name,
        }));
        expect(tenants.includes({
            id: tenant2.id,
            name: tenant2.name,
        }));
        expect(tenants.includes({
            id: tenant3.id,
            name: tenant3.name,
        }));
        expect(tenants.includes({
            id: tenant4.id,
            name: tenant4.name,
        }));
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const result = await supertest(web)
            .get('/tenants');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const result = await supertest(web)
            .get('/tenants')
            .set('Authorization', 'Bearer Salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /tenants/:tenantId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 OK when requested by member of the tenant', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        tenant.createdAt = tenant.createdAt.toISOString();
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: tenant,
        });
    });

    it('should return 200 OK when reqeuested by a non-member of the tenant', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: tenant.id,
                name: tenant.name,
            },
        });
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const tenantInformation = generateTenantInformation(key);
        const result = await supertest(web)
            .get(`/tenants/${tenantInformation.id}`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenantInformation = generateTenantInformation(key);
        const result = await supertest(web)
            .get(`/tenants/${tenantInformation.id}`)
            .set('Authorization', 'Bearer Salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when tenant id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .get('/tenants/salah')
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
    });
});

describe('PUT /tenants/:tenantId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });
    
    it('should return 200 OK when successfully update the tenant information', async () => {
        const tenant = await createTenant(key);
        const newTenantInformation = generateTenantInformation(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'SUPER_ADMIN');

        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: tenant.id,
                name: newTenantInformation.name,
                description: newTenantInformation.description,
            },
        });
    });

    it('should return 400 bad request when the request body is missing', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);

        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });

        expect(result.error.message.length).toBeGreaterThan(0);

        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
        expect(result.body.error.details[0].field.length).toBeGreaterThan(0);
        expect(result.body.error.details[0].message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const tenantInformation = await createTenant(key);
        const result = await supertest(web)
            .put(`/tenants/${tenantInformation.id}`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenantInformation = await createTenant(key);
        const result = await supertest(web)
            .put(`/tenants/${tenantInformation.id}`)
            .set('Authorization', 'Bearer Salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const newTenantInformation = generateTenantInformation(key);
        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a reguler member', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const newTenantInformation = generateTenantInformation(key);
        await joinTenant(user.id, tenant.id, 'MEMBER');
        
        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by an admin', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const newTenantInformation = generateTenantInformation(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const newTenantInformation = generateTenantInformation(key);
        await joinTenant(user.id, tenant.id, 'MANAGER');

        const result = await supertest(web)
            .put(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const user = await createUser(key);
        const newTenantInformation = generateTenantInformation(key);

        const result = await supertest(web)
            .put('/tenants/salah')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send(newTenantInformation);
        
        logger.debug(result.body);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 409 conflict when new tenant name is already taken', async () => {
        const user = await createUser(key);
        const tenant1 = await createTenant(key);
        const tenant2 = await createTenant(key);
        await joinTenant(user.id, tenant1.id, 'SUPER_ADMIN');

        const result = await supertest(web)
            .put(`/tenants/${tenant1.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                name: tenant2.name,
            });

        expect(result.status).toBe(409);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'TENANT_NAME_ALREADY_TAKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('DELETE /tenants/:tenantId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 OK when the tenant is successfully deleted', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'SUPER_ADMIN');
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
        expect(result.body.data.message.length).toBeGreaterThan(0);
        expect(await checkTenant(tenant.id)).toBe(false);
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', 'Bearer Salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toEqual(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a regular member', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toEqual(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by an admin', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toEqual(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'MANAGER');
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toEqual(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .delete('/tenants/salah')
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('POST /tenants/:tenantId/invite', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 201 created when an invite is successfully sent', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: userInformation.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        logger.debug(result.body);
        expect(result.status).toBe(201);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: expect.any(String),
                email: userInformation.email,
                tenantId: tenant.id,
                role: 'MEMBER',
                expiresAt: expect.any(String),
            },
        });
        expect(Date(result.body.data.expiresAt)).toEqual(Date('2030-10-01T00:01:50Z'));
    });

    it('should return 400 bad request when request body is missing', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });

        expect(result.error.message.length).toBeGreaterThan(0);

        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
        expect(result.body.error.details[0].field.length).toBeGreaterThan(0);
        expect(result.body.error.details[0].message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/delete`)
            .set('Authorization', 'Bearer Salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 when requested by a non-member user', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: userInformation.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        logger.debug(result.body);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 when requested by a regular member', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'MEMBER');
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: userInformation.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        logger.debug(result.body);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 when requested by a manager', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'MANAGER');
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: userInformation.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        logger.debug(result.body);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const user = await createUser(key);
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post('/tenants/salah/invite')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: userInformation.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 409 conflict when the invited user is a tenant member', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const user2 = await createUser(key);
        joinTenant(user.id, tenant.id, 'ADMIN');
        joinTenant(user2.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .post(`/tenants/${tenant.id}/invite`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                email: user2.email,
                role: 'MEMBER',
                expiresAt: '2030-10-01T00:01:50Z',
            });
        
        expect(result.status).toBe(409);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'USER_ALREADY_MEMBER',
                message: expect.any(String),
            },
        });

        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /tenants/:tenantId/members', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully retrieved all of the tenant members', async () => {
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        const user3 = await createUser(key);
        const user4 = await createUser(key);
        const tenant = await createTenant(key);

        await joinTenant(user1.id, tenant.id);
        await joinTenant(user2.id, tenant.id);
        await joinTenant(user3.id, tenant.id);
        await joinTenant(user4.id, tenant.id);

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/members`)
            .set('Authorization', `Bearer ${user1.accessToken}`);
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: expect.any(Object),
        });

        const memberArray = [user1, user2, user3, user4];
        memberArray.forEach(cleanUserData);
        expect(result.body.data.length).toBe(4);
        expect(result.body.data).toEqual(expect.arrayContaining([user1, user2, user3, user4]));
    });

    it('should return 401 bad request when requested by an authentic user', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/members`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 bad request when access token is invalid', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/members`)
            .set('Authorization', 'Bearer salah');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non admin member', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/members`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when tenant id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .get('/tenants/wrong-id/members')
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            }
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /tenants/:tenantId/invitations', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully retrieve all of invitations', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const invitation1 = await createInvitation(tenant.id, key);
        const invitation2 = await createInvitation(tenant.id, key);
        const invitation3 = await createInvitation(tenant.id, key);
        const invitation4 = await createInvitation(tenant.id, key);

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: expect.any(Object),
        });

        const invitationsArray = [
            invitation1,
            invitation2,
            invitation3,
            invitation4,
        ];

        invitationsArray.forEach(data => {
            delete data.tenantId;
        });

        expect(result.body.data.length).toBe(4);
        expect(result.body.data).toEqual(expect.arrayContaining(invitationsArray));
    });

    it('should return 401 unauthorized when requested by an unathentic user', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid', async () => {
        const tenant = await createTenant(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`)
            .set('Authorization', 'Bearer False token');

        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a regular member', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);

        await joinTenant(user.id, tenant.id);

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager member', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);

        await joinTenant(user.id, tenant.id, 'MANAGER');

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .get('/tenants/invalid-tenant-id/invitations')
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /tenants/:tenantId/invitations/:invitationId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully retrieved the invitation', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const invitation = await createInvitation(tenant.id, key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: invitation,
        });
    });

    it('should return 401 unauthorized when requested by an unauthentic user', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when the access token is invalid', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', 'Bearer invalid-token');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a regular member', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'MANAGER');
        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .get(`/tenants/invalid-tenant-id/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the invitation id is invalid', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .get(`/tenants/${tenant.id}/invitations/invalid-invitation-id`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_INVITATION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the invitation was not from the tenant', async () => {
        const tenant = await createTenant(key); 
        const invitation = await createInvitation(tenant.id, key);
        const tenant2 = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant2.id, 'ADMIN');

        const result = await supertest(web)
            .get(`/tenants/${tenant2.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_INVITATION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('DELETE /tenants/:tenantId/invitations/:invitationId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully deleted the tenant invitation', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        const invitation = await createInvitation(tenant.id, key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
        expect(result.body.data.message.length).toBeGreaterThan(0);
        expect(await checkInvitation(invitation.id)).toEqual(false);
    });

    it('should return 401 unauthorized when requested by an unauthentic user', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`);
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when the access token is invalid', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', 'Bearer invalid-token');
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a regular member', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'MANAGER');
        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const tenant = await createTenant(key);
        const invitation = await createInvitation(tenant.id, key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .delete(`/tenants/invalid-tenant-id/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the invitation id is invalid', async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .delete(`/tenants/${tenant.id}/invitations/invalid-invitation-id`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_INVITATION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the invitation was not from the tenant', async () => {
        const tenant = await createTenant(key); 
        const invitation = await createInvitation(tenant.id, key);
        const tenant2 = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant2.id, 'ADMIN');

        const result = await supertest(web)
            .delete(`/tenants/${tenant2.id}/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_INVITATION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('PATCH /tenants/:tenantId/members/:userId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully edit the member role', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user1.id, tenant.id, 'ADMIN');
        const member = await joinTenant(user2.id, tenant.id);

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: member.id,
                username: user2.username,
                email: user2.email,
                role: 'ADMIN',
            },
        });
    });

    it('should return 400 bad request when request body is missing', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user1.id, tenant.id, 'ADMIN');
        await joinTenant(user2.id, tenant.id);

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            }
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
        expect(result.body.error.details[0].field.length).toBeGreaterThan(0);
        expect(result.body.error.details[0].message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when requested by an unatuhentic user' , async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user.id}`)
            .send({
                role: 'ADMIN',
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'AUTH_REQUIRED',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 unauthorized when access token is invalid' , async () => {
        const tenant = await createTenant(key);
        const user = await createUser(key);
        await joinTenant(user.id, tenant.id);
        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user.id}`)
            .set('Authorization', 'Bearer invalid-token')
            .send({
                role: 'ADMIN',
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_ACCESS_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a non-member user', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user2.id, tenant.id);

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a regular member', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user2.id, tenant.id);
        await joinTenant(user1.id, tenant.id);
        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when requested by a manager', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user1.id, tenant.id, 'MANAGER');
        await joinTenant(user2.id, tenant.id);

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when an admin want to promote member into super admin', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user2.id, tenant.id);
        await joinTenant(user1.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'SUPER_ADMIN',
            });
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 403 forbidden when an admin want to edit a super admin member', async () => {
        const tenant = await createTenant(key);
        const user1 = await createUser(key);
        const user2 = await createUser(key);
        await joinTenant(user2.id, tenant.id, 'SUPER_ADMIN');
        await joinTenant(user1.id, tenant.id, 'ADMIN');

        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user1.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        
        expect(result.status).toBe(403);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'UNAUTHORIZED_ACTION',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the tenant id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .patch(`/tenants/invalid-tenant-id/members/${user.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        logger.debug(result.body);
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_TENANT',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when the user id is invalid', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/invalid-user-id`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_USER',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 404 not found when tyring to edit a non-member user role', async () => {
        const user = await createUser(key);
        const user2 = await createUser(key);
        const tenant = await createTenant(key);
        await joinTenant(user.id, tenant.id, 'ADMIN');
        const result = await supertest(web)
            .patch(`/tenants/${tenant.id}/members/${user2.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({
                role: 'ADMIN',
            });
        expect(result.status).toBe(404);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'NOT_FOUND_USER',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
}); 