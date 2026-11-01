export const rolePermissions = {
    Admin: ["dashboard:read", "fine:read", "fine:export", "users:read", "users:approve"],
    "Super User": ["dashboard:read", "fine:read", "fine:export", "fine:review", "activity:read"],
    Viewer: ["dashboard:read", "fine:read"],
};
export const can = (role, permission) => Boolean(rolePermissions[role]?.includes(permission));
export const canReviewFine = (role, status) => can(role, 'fine:review') && status?.toLowerCase() === 'pending';
export const pages = [
    { id: 'dashboard', label: 'Executive Summary', permission: 'dashboard:read' },
    { id: 'fines', label: 'Fines Details', permission: 'fine:read' },
    { id: 'activity', label: 'Activity Log', permission: 'activity:read' },
    { id: 'import', label: 'Import Dataset', permission: 'dataset:import' },
    { id: 'users', label: 'User Management', permission: 'users:read' },
];
export const canAccessPage = (role, page) => {
    const target = pages.find(item => item.id === page);
    return Boolean(target && can(role, target.permission));
};
export const homePage = role => can(role, 'dashboard:read') ? 'dashboard' : 'fines';
