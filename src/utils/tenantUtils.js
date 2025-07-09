export const extractTenants = (data) => (
    data.map((item) => item.tenant)
);

export const extractMembers = (data) => (
    data.map((item) => item.user)
);