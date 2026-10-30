export const rolePermissions = {
    Admin: ["dashboard:read", "fine:read", "fine:export", "fine:review", "dataset:import", "users:read", "users:approve"],
    "Super User": ["dashboard:read", "fine:read", "fine:export", "fine:review"],
    Viewer: ["fine:read", "fine:export"],
};
export const can = (role, permission) => Boolean(rolePermissions[role]?.includes(permission));
export const pages = [
    { id: 'dashboard', label: 'Executive Summary', permission: 'dashboard:read' },
    { id: 'fines', label: 'Fines Details', permission: 'fine:read' },
    { id: 'import', label: 'Import Dataset', permission: 'dataset:import' },
    { id: 'users', label: 'User Management', permission: 'users:read' },
];
export const canAccessPage = (role, page) => {
    const target = pages.find(item => item.id === page);
    return Boolean(target && can(role, target.permission));
};
export const homePage = role => can(role, 'dashboard:read') ? 'dashboard' : 'fines';
