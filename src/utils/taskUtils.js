/**
 * Maps the public-facing status from the request to the internal Prisma enum.
 * @param {string} status - The status from the request body ('todo', 'inProgress', 'done').
 * @returns {string} The corresponding Prisma TaskStatus enum ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').
 */
export const mapStatusToPrismaEnum = (status) => {
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
export const mapPrismaEnumToStatus = (prismaStatus) => {
    const statusMap = {
        NOT_STARTED: 'todo',
        IN_PROGRESS: 'inProgress',
        COMPLETED: 'done',
    };
    return statusMap[prismaStatus];
};

export const compareArrayWithoutOrder = (arr1, arr2) => {
    if (arr1.length !== arr2.length) {
        return false;
    }
    const frequency = {};
    for (let item of arr1) {
        if (!frequency[item]) {
            frequency[item] = 0;
        }
        frequency[item]++;  
    }
    for (let item of arr2) {
        if (!frequency[item] || frequency[item] <= 0) {
            return false;
        }
    }
    return true;
};