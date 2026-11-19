export const TASK_CREATION_TYPES = Object.freeze(['epic', 'story', 'task']);

const ALLOWED_PARENT_TYPE = Object.freeze({
    story: 'epic',
    task: 'story'
});

export function getAllowedParentType(childType) {
    return ALLOWED_PARENT_TYPE[childType] || null;
}

export function getEligibleParentTasks(childType, tasks = [], excludedTaskId = '') {
    const parentType = getAllowedParentType(childType);
    if (!parentType || !Array.isArray(tasks)) {
        return [];
    }

    return tasks.filter(task =>
        task.id !== excludedTaskId &&
        task.type === parentType
    );
}
