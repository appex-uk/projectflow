import assert from 'node:assert/strict';
import test from 'node:test';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const stateManager = {
    listeners: new Map(),
    addEventListener(event, listener) {
        this.listeners.set(event, listener);
    },
    dispatchEvent(event, data) {
        this.listeners.get(event)?.(data);
    },
    getCurrentView() {
        return 'timeline';
    }
};
globalThis.__taskManagerTestState = stateManager;

const { readFile } = await import('node:fs/promises');
const moduleSource = await readFile(
    new URL('../static/js/task-manager.js', import.meta.url),
    'utf8'
);
const dependencies = [
    ["'./api-client.js'", `'${moduleURL('export const apiClient = {};')}'`],
    ["'./state-manager.js'", `'${moduleURL('export const stateManager = globalThis.__taskManagerTestState;')}'`],
    [
        "'./utils.js'",
        `'${moduleURL(`
            export const showMessage = () => {};
            export const escapeHtml = value => String(value || '');
            export const formatDate = value => value || '';
            export const formatDateTime = value => value || '';
            export const getTaskTypeIcon = () => 'task';
            export const syncKanbanTaskList = () => {};
        `)}'`
    ]
];
const testModuleSource = dependencies.reduce(
    (source, [specifier, replacement]) => source.replace(specifier, replacement),
    moduleSource
);
const { TaskManager } = await import(moduleURL(testModuleSource));

class FakeTimelineItem {
    constructor(taskId) {
        this.dataset = { id: taskId };
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    dispatch(type, event = {}) {
        let prevented = false;
        this.listeners.get(type)?.({
            preventDefault() {
                prevented = true;
            },
            ...event
        });
        return prevented;
    }
}

test('timeline items dispatch the selected task for the details modal', () => {
    const timelineItem = new FakeTimelineItem('task-1');
    const container = {
        innerHTML: '',
        querySelectorAll(selector) {
            return selector === '.timeline-item' ? [timelineItem] : [];
        }
    };
    const task = {
        id: 'task-1',
        title: 'Release checklist',
        description: 'Prepare the release',
        type: 'task',
        priority: 'high',
        status: 'todo',
        due_date: '2026-11-20'
    };
    const openedTasks = [];
    const manager = new TaskManager();

    manager.showTaskDetail = selectedTask => openedTasks.push(selectedTask);
    manager.buildTimelineView([task], container);

    assert.match(container.innerHTML, /tabindex="0"/);
    assert.match(container.innerHTML, /role="button"/);

    timelineItem.dispatch('click');
    assert.equal(timelineItem.dispatch('keydown', { key: 'Enter' }), true);
    assert.equal(timelineItem.dispatch('keydown', { key: ' ' }), true);
    assert.deepEqual(openedTasks, [task, task, task]);
});
