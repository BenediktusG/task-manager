import supertest from "supertest";
import { checkMember, checkRefreshToken, createInvitationUsingEmail, createTenant, createUser, generateKey, generateUserInformation, removeAllData, removeAllUsers } from "./test-utils.js";
import { web } from "../src/application/web.js";
import { logger } from "../src/application/logging.js";

describe('POST /auth/register', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });

    it('should retrun 201 Created when registering a new user successfully', async () => {
        const userInformation = generateUserInformation(key);
        const result = await supertest(web)
            .post('/auth/register')
            .send(userInformation);
        logger.debug(result.body);
        logger.debug(userInformation);
        expect(result.status).toBe(201);
        expect(result.body.success).toBe(true);
        expect(result.body.data).toBeDefined();
        expect(result.body.data.id).toBeDefined();
        expect(result.body.data.username).toBe(userInformation.username);
        expect(result.body.data.email).toBe(userInformation.email);
    });

    it('should return 400 Bad Request when request body is invalid', async () => {
        const userInformation = generateUserInformation(key);
        userInformation.confirmationPassword += 'a';
        const result = await supertest(web)
            .post('/auth/register')
            .send(userInformation);
        expect(result.status).toBe(400);
        expect(result.body.success).toBe(false);
        expect(result.body.error).toBeDefined();
        expect(result.body.error.code).toBe('VALIDATION_ERROR');
        expect(result.body.error.message).toBe('The request contains invalid fields');
        expect(result.body.error.details).toBeDefined();
        expect(result.body.error.details).toHaveLength(1);
    });

    it('should return 409 Conflict when username or email is already taken', async () => {
        const userInformation = await createUser(key);
        logger.debug(userInformation);
        delete userInformation.id;
        userInformation.confirmationPassword = userInformation.password;
        delete userInformation.accessToken;
        delete userInformation.refreshToken;
        const result = await supertest(web)
            .post('/auth/register')
            .send(userInformation);
        expect(result.status).toBe(409);
        expect(result.body.success).toBe(false);
        expect(result.body.error).toBeDefined();
        expect(result.body.error.code).toBe('USERNAME_ALREADY_TAKEN');
        expect(result.body.error.message).toBe('Username already taken');
    });
});

describe('POST /auth/login', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });
    
    it('should return 200 OK when user successfully logging in', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/auth/login')
            .send({
                username: userInformation.username,
                password: userInformation.password,
            });
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        expect(result.body.data).toHaveProperty('accessToken');
        expect(result.body.data).toHaveProperty('refreshToken');
        expect(typeof result.body.data.accessToken).toBe('string');
        expect(typeof result.body.data.refreshToken).toBe('string');
        expect(result.body.data.accessToken.length).toBeGreaterThan(0);
        expect(result.body.data.refreshToken.length).toBeGreaterThan(0);
    });

    it('should return 400 Bad Request when request body is invalid', async () => {
        const result = await supertest(web)
            .post('/auth/login')
            .send({
                username: 'test',
            });
        expect(result.status).toBe(400);
        expect(result.body).toHaveProperty('success');
        expect(result.body.success).toBe(false);
        expect(result.body).toHaveProperty('error');
        expect(result.body.error).toHaveProperty('code');
        expect(result.body.error.code).toBe('VALIDATION_ERROR');
        expect(result.body.error).toHaveProperty('message');
        expect(typeof result.body.error.message).toBe('string');
        expect(result.body.error.message.length).toBeGreaterThan(0);
        expect(result.body.error).toHaveProperty('details');
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toHaveProperty('field');
        expect(typeof result.body.error.details[0].field).toBe('string');
        expect(result.body.error.details[0].field.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toHaveProperty('message');
        expect(typeof result.body.error.details[0].message).toBe('string');
        expect(result.body.error.details[0].message.length).toBeGreaterThan(0);
    });

    it('should return 401 Unauthorized when credentials are invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/auth/login')
            .send({
                username: userInformation.username,
                password: userInformation.password + 'a',
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_CREDENTIALS',
                message: expect.any(String),
            },
        });
    });
});

describe('POST /auth/refresh', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });

    it('should return 200 OK when a user successfully refreshes their access token', async () => {
        const userInformation = await createUser(key);
        logger.debug(userInformation);
        const result = await supertest(web)
            .post('/auth/refresh')
            .send({
                refreshToken: userInformation.refreshToken,
            });
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            }
        });
        expect(result.body.data.accessToken.length).toBeGreaterThan(0);
        expect(result.body.data.accessToken).not.toBe(userInformation.accessToken); 
        expect(result.body.data.refreshToken.length).toBeGreaterThan(0);
        expect(result.body.data.refreshToken).not.toBe(userInformation.refreshToken);
    });

    it('should return 400 bad request when request body is invalid', async () => {
        const result = await supertest(web)
            .post('/auth/refresh');
        logger.debug(result.body);
        expect(result.status).toBe(400);    
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: [
                    {
                        field: expect.any(String),
                        message: expect.any(String),
                    },
                ],
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 Unauthorized when refresh token is invalid', async () => {
        const result = await supertest(web)
            .post('/auth/refresh')
            .send({
                refreshToken: 'salahBanget',
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_REFRESH_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('POST /auth/logout', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });
    
    it('should return 200 OK when a user successfully logging out', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/auth/logout')
            .send({
                refreshToken: userInformation.refreshToken,
            });
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
        expect(result.body.data.message.length).toBeGreaterThan(0);
        expect(await checkRefreshToken(userInformation.refreshToken)).toBe(false);
    });

    it('should return 400 bad request when request body is invalid', async () => {
        const result = await supertest(web)
            .post('/auth/logout');
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: [
                    {
                        field: expect.any(String),
                        message: expect.any(String),
                    },
                ],
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 401 when refresh token is invalid or expired', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .post('/auth/logout')
            .send({
                refreshToken: userInformation.refreshToken + 'a',
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_REFRESH_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('GET /auth/me', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });
    
    it('should return 200 OK when a user successfully gets their information', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .get('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken);
        logger.debug(result.body);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: userInformation.id,
                username: userInformation.username,
                email: userInformation.email,
            }
        })
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const result = await supertest(web)
            .get('/auth/me');
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
        const result = await supertest(web)
            .get('/auth/me')
            .set('Authorization', 'Bearer salah');
        logger.debug(result.body);
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

describe('PATCH /auth/me', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });
    
    it('should return 200 OK when a user successfully edit their account information', async () => {
        const oldUserInformation = await createUser(key);
        const newUserInformation = generateUserInformation(key);

        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + oldUserInformation.accessToken)
            .send({
                username: newUserInformation.username,
                email: newUserInformation.email,
            });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                id: oldUserInformation.id,
                username: newUserInformation.username,
                email: newUserInformation.email,
            },
        });
    });

    it('should return 400 Bad Request if the request body is missing', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 400 Bad Request if the username is invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                username: 'a',
            });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 400 Bad Request if the email is invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                email: 'a',
            });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 400 Bad Request if the email is valid but username is invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                email: 'a@gmail.com',
                username: 'a'
            });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 400 Bad Request if the username is valid but username is invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                email: 'a',
                username: 'Budi12345'
            });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 400 Bad Request if both of username and email are invalid', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                email: 'a',
                username: 'a'
            });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 401 Unauthorized when requested by an uanthenticated user', async () => {
        const result = await supertest(web)
            .patch('/auth/me');
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

    it('should return 401 Unauthorized when the refresh token is invalid or expired', async () => {
        const result = await supertest(web)
            .patch('/auth/me')
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

    it('should return 409 Conflict if username already exists', async () => {
        const userInformation = await createUser(key);
        const newUserInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                username: newUserInformation.username,
            });
        expect(result.status).toBe(409);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'USERNAME_ALREADY_TAKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });

    it('should return 409 Conflict if email already exists', async () => {
        const userInformation = await createUser(key);
        const newUserInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                email: newUserInformation.email,
            });
        expect(result.status).toBe(409);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'EMAIL_ALREADY_TAKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);
    });
});

describe('DELETE /auth/me', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });
    it('should return 200 OK when the user successfully delete their account', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web) 
            .delete('/auth/me')
            .set('Authorization', 'Bearer ' + userInformation.accessToken);
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
    });

    it('should return 401 Unauthorized when requested by an uanthenticated user', async () => {
        const result = await supertest(web)
            .delete('/auth/me');
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

    it('should return 401 Unauthorized when the refresh token is invalid or expired', async () => {
        const result = await supertest(web)
            .delete('/auth/me')
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
});

describe('PATCH /auth/password', () => {
    let key;
    beforeEach(() => {
        key = generateKey();
    });
    afterEach(async () => {
        await removeAllUsers(key);
    });

    it('should return 200 OK when the user successfully changed their password', async () => {
        const userInformation = await createUser(key);
        const newUserInformation = generateUserInformation(key);

        let result = await supertest(web)
            .patch('/auth/password')
            .set('Authorization', 'Bearer ' + userInformation.accessToken)
            .send({
                oldPassword: userInformation.password,
                newPassword: newUserInformation.password,
                confirmationPassword: newUserInformation.password,
            });
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
        expect(result.body.data.message.length).toBeGreaterThan(0);

        // Test login using old password
        result = await supertest(web)
            .post('/auth/login')
            .send({
                username: userInformation.username,
                password: userInformation.password,
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_CREDENTIALS',
                message: expect.any(String),
            },
        });

        // Test refresh access token
        result = await supertest(web)
            .post('/auth/refresh')
            .send({
                refreshToken: userInformation.refreshToken,
            });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'INVALID_REFRESH_TOKEN',
                message: expect.any(String),
            },
        });
        expect(result.body.error.message.length).toBeGreaterThan(0);

        // Test login using new password
        result = await supertest(web)
            .post('/auth/login')
            .send({
                username: userInformation.username,
                password: newUserInformation.password,
            });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            },
        });
    });

    it('should return 400 Bad Request if the request body is missing', async () => {
        const userInformation = await createUser(key);
        const result = await supertest(web)
            .patch('/auth/password')
            .set('Authorization', 'Bearer ' + userInformation.accessToken);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                details: expect.any(Object),
            },
        });
        expect(result.body.error.details.length).toBeGreaterThan(0);
        expect(result.body.error.details[0]).toEqual({
            field: expect.any(String),
            message: expect.any(String),
        });
    });

    it('should return 401 Unauthorized when requested by an uanthenticated user', async () => {
        const result = await supertest(web)
            .patch('/auth/password')
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

    it('should return 401 Unauthorized when the refresh token is invalid or expired', async () => {
        const result = await supertest(web)
            .patch('/auth/password')
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
});

describe('GET /users/invitations', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it("should return 200 ok when successfully retrieved all of the tenant's invitation", async () => {
        const user = await createUser(key);
        const invitations = [];
        for (let i = 0; i < 5; i+=1) {
           const tenant = await createTenant(key);
           const invitation = await createInvitationUsingEmail(tenant.id, user.email);
           invitation.tenantName = tenant.name;
           invitations.push(invitation);
        }

        const result = await supertest(web)
            .get('/users/invitations')
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: expect.any(Object),
        });

        expect(result.body.data).toHaveLength(5);
        invitations.forEach((invitation) => {
            expect(result.body.data).toContainEqual({
                id: invitation.id,
                tenantId: invitation.tenantId,
                tenantName: invitation.tenantName,
                role: invitation.role,
            });
        });
    });

    it('should return 401 unathorized when requested by an unathenticated user', async () => {
        const result = await supertest(web)
            .get('/users/invitations');
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

    it('should return 401 unathorized when access token is invalid', async () => {
        const result = await supertest(web)
            .get('/users/invitations')
            .set('Authorization', 'Bearer invalid-access-token');
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

describe('GET /users/invitations/:invitationId', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });

    it('should return 200 ok when successfully retrieve the invitation', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        const result = await supertest(web)
            .get(`/users/invitations/${invitation.id}`)
            .set('Authorization', `Bearer ${user.accessToken}`);
        
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: invitation,
        });
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        const result = await supertest(web)
            .get(`/users/invitations/${invitation.id}`);
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
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        const result = await supertest(web)
            .get(`/users/invitations/${invitation.id}`)
            .set('Authorization', 'Bearer invalid-access-token');
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

    it('should return 404 not found when invitation id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .get('/users/invitations/invalid-invitation-id')
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
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

describe('POST /users/invitations/:invitationId/accept', () => {
    let key;
    beforeEach(() => {
        key = generateKey();    
    });
    afterEach(async () => {
        await removeAllData(key);
    });
    
    it('should return 200 ok when successfully accept the tenant invitation', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        
        const result = await supertest(web)
            .post(`/users/invitations/${invitation.id}/accept`)
            .set('Authorization', `Bearer ${user.accessToken}`);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            data: {
                message: expect.any(String),
            },
        });
        expect(result.body.data.message.length).toBeGreaterThan(0);
        expect(await checkMember(user.id, tenant.id)).toBe(true);
    });

    it('should return 401 unauthorized when requested by an unauthenticated user', async () => {
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        const result = await supertest(web)
            .post(`/users/invitations/${invitation.id}/accept`);
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
        const user = await createUser(key);
        const tenant = await createTenant(key);
        const invitation = await createInvitationUsingEmail(tenant.id, user.email);
        const result = await supertest(web)
            .post(`/users/invitations/${invitation.id}/accept`)
            .set('Authorization', 'Bearer invalid-access-token');
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

    it('should return 404 not found when invitation id is invalid', async () => {
        const user = await createUser(key);
        const result = await supertest(web)
            .post('/users/invitations/invalid-invitation-id/accept')
            .set('Authorization', `Bearer ${user.accessToken}`);
        logger.debug(result.body);
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