import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSource = await readFile(
    new URL('../static/js/task-detail-manager.js', import.meta.url),
    'utf8'
);
const templateSource = await readFile(
    new URL('../templates/index.html', import.meta.url),
    'utf8'
);
const utilsModule = `
    export const formatDate = value => value || '';
    export const formatDateTime = value => value || '';
    export const escapeHtml = value => String(value || '');
`;
const utilsURL = `data:text/javascript;base64,${Buffer.from(utilsModule).toString('base64')}`;
const hierarchySource = await readFile(
    new URL('../static/js/task-hierarchy.js', import.meta.url),
    'utf8'
);
const hierarchyURL = `data:text/javascript;base64,${Buffer.from(hierarchySource).toString('base64')}`;
const testModuleSource = moduleSource
    .replace("from './utils.js'", `from '${utilsURL}'`)
    .replace("from './task-hierarchy.js'", `from '${hierarchyURL}'`);
const { TaskDetailManager } = await import(
    `data:text/javascript;base64,${Buffer.from(testModuleSource).toString('base64')}`
);

test('task creation has one visible entry point', () => {
    assert.doesNotMatch(templateSource, /id="fab-new-task"/);
    assert.match(templateSource, /id="new-task-menu"/);
    assert.doesNotMatch(moduleSource, /fabNewTaskButton/);
});

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.style = {};
        this.listeners = new Map();
        this.classList = { contains: () => false };
        this.children = new Map();
        this.values = new Map();
        this.focused = false;
        this.open_ = false;
        this.disabled = false;
        this.hidden = false;
        this.innerHTML = '';
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    async dispatch(type, event = {}) {
        const listeners = this.listeners.get(type) || [];
        for (const listener of listeners) {
            await listener({ target: this, preventDefault() {}, stopPropagation() {}, ...event });
        }
    }

    querySelector(selector) {
        return this.children.get(selector) || null;
    }

    querySelectorAll() {
        return [];
    }

    click() {
        return this.dispatch('click');
    }

    focus() {
        this.focused = true;
    }

    reset() {
        this.values.clear();
    }

    removeAttribute(name) {
        delete this[name];
    }

    open() {
        this.open_ = true;
    }

    close() {
        this.open_ = false;
    }
}

class FakeDocument {
    constructor(elements) {
        this.elements = elements;
        this.listeners = new Map();
        this.body = new FakeElement('body');
    }

    getElementById(id) {
        return this.elements.get(id) || null;
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
}

function createHarness(taskManager, { withMenu = false, tasks = [] } = {}) {
    const newTaskButton = new FakeElement('new-task-btn');
    const newTaskMenu = new FakeElement('new-task-menu');
    const detailModal = new FakeElement('task-detail-modal');
    const taskModal = new FakeElement('task-modal');
    taskModal.style.display = 'none';

    const form = new FakeElement('task-form');
    taskModal.children.set('#task-form', form);
    taskModal.querySelector = selector => taskModal.children.get(selector) || null;

    const title = new FakeElement('modal-title');
    title.textContent = '';
    const titleInput = new FakeElement('task-title');
    const cancelButton = new FakeElement('cancel-btn');
    const parentGroup = new FakeElement('task-parent-group');
    const parentSelect = new FakeElement('task-parent-id');
    const parentHint = new FakeElement('task-parent-hint');
    taskModal.children.set('#modal-title', title);
    form.children.set('#task-title', titleInput);
    form.children.set('#cancel-btn', cancelButton);
    form.children.set('#task-description', new FakeElement('task-description'));
    form.children.set('#task-type', new FakeElement('task-type'));
    form.children.set('#task-priority', new FakeElement('task-priority'));
    form.children.set('#task-status', new FakeElement('task-status'));
    form.children.set('#task-due-date', new FakeElement('task-due-date'));
    form.children.set('#task-started-at', new FakeElement('task-started-at'));
    form.children.set('#task-parent-id', parentSelect);
    form.querySelector = selector => form.children.get(selector) || null;

    const fakeDocument = new FakeDocument(new Map([
        ['new-task-btn', newTaskButton],
        ['new-task-menu', withMenu ? newTaskMenu : null],
        ['task-detail-modal', detailModal],
        ['task-modal', taskModal],
        ['task-form', form],
        ['cancel-btn', cancelButton],
        ['task-title', titleInput],
        ['modal-title', title],
        ['task-parent-group', parentGroup],
        ['task-parent-id', parentSelect],
        ['task-parent-hint', parentHint]
    ]));
    globalThis.document = fakeDocument;
    globalThis.MutationObserver = class {
        observe() {}
    };
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.FormData = class {
        constructor(element) {
            this.element = element;
        }

        get(name) {
            if (this.element.values.has(name)) {
                return this.element.values.get(name);
            }
            const field = this.element.querySelector(`#task-${name.replaceAll('_', '-')}`);
            return field && !field.disabled ? field.value ?? null : null;
        }
    };

    const stateManager = {
        listeners: new Map(),
        getCurrentProject: () => ({ id: 'project-1', display_prefix: 'LAUNCH' }),
        addEventListener(event, listener) {
            const listeners = this.listeners.get(event) || [];
            listeners.push(listener);
            this.listeners.set(event, listeners);
        },
        dispatchEvent(event, data) {
            for (const listener of this.listeners.get(event) || []) {
                listener(data);
            }
        }
    };

    const apiClient = {
        async loadTasks() {
            return tasks;
        }
    };
    const manager = new TaskDetailManager(apiClient, stateManager, taskManager);
    return {
        manager,
        detailModal,
        newTaskButton,
        newTaskMenu,
        parentGroup,
        parentHint,
        parentSelect,
        stateManager,
        taskModal,
        form,
        title,
        titleInput
    };
}

test('New Task opens the form and creates a task in the selected project', async () => {
    const created = [];
    const taskManager = {
        processTaskFormData(formData) {
            return {
                title: formData.get('title'),
                description: formData.get('description'),
                type: formData.get('type'),
                priority: formData.get('priority'),
                status: formData.get('status')
            };
        },
        async createTask(data) {
            created.push(data);
        },
        async updateTask() {
            assert.fail('New Task must use createTask, not updateTask');
        }
    };
    const { newTaskButton, taskModal, form, title, titleInput } = createHarness(taskManager);

    await newTaskButton.click();

    assert.equal(taskModal.style.display, 'block');
    assert.equal(title.textContent, 'New Task');
    assert.equal(titleInput.focused, true);

    form.values.set('title', 'Launch checklist');
    form.values.set('description', 'Prepare the release');
    form.values.set('type', 'task');
    form.values.set('priority', 'high');
    form.values.set('status', 'todo');
    form.values.set('due_date', '');
    form.values.set('started_at', '');
    await form.dispatch('submit');

    assert.deepEqual(created, [{
        title: 'Launch checklist',
        description: 'Prepare the release',
        type: 'task',
        priority: 'high',
        status: 'todo'
    }]);
    assert.equal(taskModal.style.display, 'none');
});

test('the same form continues to update existing tasks', async () => {
    const updated = [];
    const taskManager = {
        processTaskFormData(formData) {
            return {
                title: formData.get('title'),
                description: formData.get('description'),
                type: formData.get('type'),
                priority: formData.get('priority'),
                status: formData.get('status')
            };
        },
        async createTask() {
            assert.fail('Editing a task must use updateTask, not createTask');
        },
        async updateTask(id, data) {
            updated.push({ id, data });
        }
    };
    const { manager, taskModal, form } = createHarness(taskManager);

    manager.populateEditModal({
        id: 'task-1',
        display_id: 'LAUNCH-1',
        title: 'Original title',
        description: 'Original description',
        type: 'task',
        priority: 'medium',
        status: 'todo'
    });
    manager.showEditModal();
    form.querySelector('#task-title').value = 'Updated title';

    await form.dispatch('submit');

    assert.deepEqual(updated, [{
        id: 'task-1',
        data: {
            title: 'Updated title',
            description: 'Original description',
            type: 'task',
            priority: 'medium',
            status: 'todo'
        }
    }]);
    assert.equal(taskModal.style.display, 'none');
});

test('task details use the WDS dialog lifecycle', () => {
    const taskManager = {
        async createTask() {},
        async updateTask() {}
    };
    const { manager, detailModal } = createHarness(taskManager);

    manager.showModal();
    assert.equal(detailModal.open_, true);

    manager.hideModal();
    assert.equal(detailModal.open_, false);
});

test('New Task menu selects the type and filters the available parents', async () => {
    const created = [];
    const taskManager = {
        processTaskFormData(formData) {
            return {
                title: formData.get('title'),
                type: formData.get('type'),
                parent_id: formData.get('parent_id')
            };
        },
        async createTask(data) {
            created.push(data);
        },
        async updateTask() {}
    };
    const {
        newTaskMenu,
        taskModal,
        form,
        parentGroup,
        parentSelect,
        title
    } = createHarness(taskManager, {
        withMenu: true,
        tasks: [
            { id: 'epic-1', display_id: 'PF-1', title: 'Checkout programme', type: 'epic' },
            { id: 'story-1', display_id: 'PF-2', title: 'Payment flow', type: 'story' },
            { id: 'task-1', display_id: 'PF-3', title: 'Add card form', type: 'task' }
        ]
    });

    await newTaskMenu.dispatch('wds-select', { detail: { value: 'story' } });

    assert.equal(taskModal.style.display, 'block');
    assert.equal(title.textContent, 'New Story');
    assert.equal(form.querySelector('#task-type').value, 'story');
    assert.equal(parentGroup.hidden, false);
    assert.match(parentSelect.innerHTML, /epic-1/);
    assert.doesNotMatch(parentSelect.innerHTML, /story-1/);
    assert.doesNotMatch(parentSelect.innerHTML, /task-1/);

    form.values.set('title', 'Create receipt screen');
    parentSelect.value = 'epic-1';
    await form.dispatch('submit');

    assert.deepEqual(created, [{
        title: 'Create receipt screen',
        type: 'story',
        parent_id: 'epic-1'
    }]);
});

test('Epic creation hides and clears the parent selector', async () => {
    const taskManager = {
        async createTask() {},
        async updateTask() {}
    };
    const {
        newTaskMenu,
        form,
        parentGroup,
        parentSelect
    } = createHarness(taskManager, {
        withMenu: true,
        tasks: [{ id: 'epic-1', title: 'Programme', type: 'epic' }]
    });

    await newTaskMenu.dispatch('wds-select', { detail: { value: 'epic' } });

    assert.equal(form.querySelector('#task-type').value, 'epic');
    assert.equal(parentGroup.hidden, true);
    assert.equal(parentGroup.style.display, 'none');
    assert.equal(parentSelect.value, '');
    assert.equal(parentSelect.disabled, false);
});

test('work breakdown task events open the selected task details', () => {
    const taskManager = {
        async createTask() {},
        async updateTask() {}
    };
    const { manager, stateManager } = createHarness(taskManager);
    const openedTasks = [];

    manager.showTaskDetails = async taskId => {
        openedTasks.push(taskId);
    };

    stateManager.dispatchEvent('show-task-detail', {
        task: { id: 'task-from-hierarchy' }
    });

    assert.deepEqual(openedTasks, ['task-from-hierarchy']);
});
