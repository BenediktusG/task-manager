import { ValidationError } from "../error/validation-error.js";

const validate = (schema, request) => {
    request = request ? request : {};
    const result = schema.validate(request, {
        abortEarly: false,
        allUnknown: false,
    });
    if (result.error) {
        throw new ValidationError(result.error.details);
    } else {
        return result.value;
    }
};

export {
    validate,
}