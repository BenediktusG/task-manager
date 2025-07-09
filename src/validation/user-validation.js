import Joi from "joi";

const registerUserValidation = Joi.object({
    username: Joi.string().min(4).max(20).pattern(/^[a-zA-Z0-9_]+$/).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&_]{8,128}$/).required(),
    confirmationPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only':'Confirmation password does not match password',
    }),
});

const loginValidation = Joi.object({
    username: Joi.string().min(1).required(),
    password: Joi.string().required().min(1),
});

const refreshAccessTokenValidation = Joi.object({
    refreshToken: Joi.string().min(1).required(),
});

const editCurrentUserInformationValidation = Joi.object({
    username: Joi.string().min(4).max(20).pattern(/^[a-zA-Z0-9_]+$/),
    email: Joi.string().email(),    
}).or('username', 'email');

const changePasswordValidation = Joi.object({
    oldPassword: Joi.string().min(1).required(),
    newPassword: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&_]{8,128}$/).required(),
    confirmationPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
        'any.only':'Confirmation password does not match with the new password',
    }),
});

export {
    registerUserValidation,
    loginValidation,
    refreshAccessTokenValidation,
    editCurrentUserInformationValidation,
    changePasswordValidation,
};