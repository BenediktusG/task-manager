import Joi from "joi";

export const createTaskValidation = Joi.object({
    // 'title' is a required string with a length between 4 and 30 characters.
    title: Joi.string()
        .min(4)
        .max(30)
        .required()
        .messages({
            'string.base': `"title" should be a type of 'text'`,
            'string.empty': `"title" cannot be an empty field`,
            'string.min': `"title" should have a minimum length of {#limit}`,
            'string.max': `"title" should have a maximum length of {#limit}`,
            'any.required': `"title" is a required field`
        }),

    // 'description' is a required string with a length between 4 and 1000 characters.
    description: Joi.string()
        .min(4)
        .max(1000)
        .required()
        .messages({
            'string.base': `"description" should be a type of 'text'`,
            'string.empty': `"description" cannot be an empty field`,
            'string.min': `"description" should have a minimum length of {#limit}`,
            'string.max': `"description" should have a maximum length of {#limit}`,
            'any.required': `"description" is a required field`
        }),

    // 'priority' is an optional integer between 1 and 5.
    priority: Joi.number()
        .integer()
        .min(1)
        .max(5)
        .messages({
            'number.base': `"priority" should be a type of 'number'`,
            'number.integer': `"priority" must be an integer`,
            'number.min': `"priority" must be greater than or equal to {#limit}`,
            'number.max': `"priority" must be less than or equal to {#limit}`
        }),

    // 'progress' is an optional integer between 0 and 100.
    progress: Joi.number()
        .integer()
        .min(0)
        .max(100)
        .messages({
            'number.base': `"progress" should be a type of 'number'`,
            'number.integer': `"progress" must be an integer`,
            'number.min': `"progress" must be greater than or equal to {#limit}`,
            'number.max': `"progress" must be less than or equal to {#limit}`
        }),

    // 'status' is an optional string that must be one of the specified values.
    status: Joi.string()
        .valid('todo', 'inProgress', 'done')
        .messages({
            'any.only': `"status" must be one of [todo, inProgress, done]`
        }),

    // 'assignedTo' is a required array of strings, where each string must be a valid UUID.
    assignedTo: Joi.array()
        .items(Joi.string().uuid({ version: 'uuidv4' }))
        .required()
        .messages({
            'array.base': `"assignedTo" should be an array`,
            'any.required': `"assignedTo" is a required field`,
            'string.guid': `each item in "assignedTo" must be a valid UUID`
        }),

    // 'due' is a required date. Joi's date type handles ISO 8601 date-time strings.
    due: Joi.date()
        .iso()
        .required()
        .messages({
            'date.base': `"due" should be a valid date`,
            'date.format': `"due" must be in ISO 8601 date format`,
            'any.required': `"due" is a required field`
        })
});