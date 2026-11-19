import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const moduleSource = await readFile(
    new URL('../static/js/view-manager.js', import.meta.url),
    'utf8'
);
const utilsModuleSource = await readFile(
    new URL('../static/js/utils.js', import.meta.url),
    'utf8'
);
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

class FakeElement {
    constructor(style = {}) {
        this.style = { ...style };
        this.dataset = {};
        this.listeners = new Map();
        this.classList = {
            add() {},
            remove() {}
        };
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }
}

function createDocument() {
    const elements = new Map([
        ['kanban-view-btn', new FakeElement()],
        ['hierarchy-view-btn', new FakeElement()],
        ['timeline-view-btn', new FakeElement()],
        ['kanban-view', new FakeElement()],
        ['hierarchy-view', new FakeElement({ display: 'none' })],
        ['timeline-view', new FakeElement({ display: 'none' })],
        ['projectflow-shell', new FakeElement()]
    ]);

    return {
        elements,
        addEventListener() {},
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

const fakeDocument = createDocument();
let currentView = 'kanban';
const stateManager = {
    addEventListener() {},
    getCurrentView() {
        return currentView;
    },
    setCurrentView() {}
};
const taskManager = {};

globalThis.document = fakeDocument;
globalThis.__viewManagerTestState = stateManager;
globalThis.__viewManagerTestTaskManager = taskManager;

const dependencies = [
    [
        "'./state-manager.js'",
        `'${moduleURL('export const stateManager = globalThis.__viewManagerTestState;')}'`
    ],
    [
        "'./task-manager.js'",
        `'${moduleURL('export const taskManager = globalThis.__viewManagerTestTaskManager;')}'`
    ],
    [
        "'./utils.js'",
        `'${moduleURL(utilsModuleSource)}'`
    ]
];
const testModuleSource = dependencies.reduce(
    (source, [specifier, replacement]) => source.replace(specifier, replacement),
    moduleSource
);
const { viewManager } = await import(moduleURL(testModuleSource));

test('showing a view leaves its CSS layout intact', () => {
    globalThis.document = fakeDocument;

    const kanban = fakeDocument.elements.get('kanban-view');
    const hierarchy = fakeDocument.elements.get('hierarchy-view');

    assert.equal(kanban.style.display, '');
    assert.equal(hierarchy.style.display, 'none');

    viewManager.hideViewContent('kanban');
    viewManager.showViewContent('kanban');

    assert.equal(kanban.style.display, '');
    assert.equal(hierarchy.style.display, 'none');
});

test('work breakdown marks the shell for a full-height layout', () => {
    globalThis.document = fakeDocument;

    const shell = fakeDocument.elements.get('projectflow-shell');

    currentView = 'hierarchy';
    viewManager.updateViewButtons();

    assert.equal(shell.dataset.currentView, 'hierarchy');

    currentView = 'kanban';
    viewManager.updateViewButtons();

    assert.equal(shell.dataset.currentView, 'kanban');
});

test('work breakdown CSS grows the tree into the remaining viewport', async () => {
    const css = await readFile(
        new URL('../static/css/product.css', import.meta.url),
        'utf8'
    );

    assert.match(
        css,
        /#projectflow-shell\[data-current-view="hierarchy"\]\s*\{[^}]*height:\s*100svh;[^}]*min-height:\s*0;/s,
        'the app shell should be constrained to the viewport while the tree is active'
    );
    assert.match(
        css,
        /#projectflow-shell\[data-current-view="hierarchy"\]\s+\.hierarchy-view\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s,
        'the work breakdown panel should consume the remaining page height'
    );
    assert.match(
        css,
        /#projectflow-shell\[data-current-view="hierarchy"\]\s+\.hierarchy-container\s*\{[^}]*flex:\s*1 1 auto;[^}]*max-height:\s*none;[^}]*min-height:\s*0;/s,
        'the tree scroller should not retain a fixed 450px cap'
    );
});

test('moving a card keeps both kanban column empty states in sync', async () => {
    let destinationPlaceholderRemoved = false;
    let sourcePlaceholderHtml = '';
    const movedTasks = [];

    taskManager.moveTask = async (taskId, status) => {
        movedTasks.push({ taskId, status });
    };

    const sourceHeading = { dataset: { count: '1' } };
    const destinationHeading = { dataset: { count: '0' } };
    const sourceColumn = {
        dataset: { status: 'todo' },
        querySelector(selector) {
            if (selector === 'h3') return sourceHeading;
            if (selector === '.task-list') return sourceList;
            return null;
        },
        classList: {
            remove() {}
        }
    };
    const destinationColumn = {
        dataset: { status: 'in_progress' },
        querySelector(selector) {
            if (selector === 'h3') return destinationHeading;
            if (selector === '.task-list') return destinationList;
            return null;
        },
        classList: {
            remove() {}
        }
    };
    const sourceList = {
        cards: [],
        closest(selector) {
            return selector === '.column' ? sourceColumn : null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.task-card' ? this.cards : [];
        },
        insertAdjacentHTML(position, html) {
            assert.equal(position, 'beforeend');
            sourcePlaceholderHtml = html;
        }
    };
    const destinationPlaceholder = {
        remove() {
            destinationPlaceholderRemoved = true;
        }
    };
    const destinationList = {
        cards: [],
        closest(selector) {
            return selector === '.column' ? destinationColumn : null;
        },
        querySelector(selector) {
            return selector === '.task-column-empty' && !destinationPlaceholderRemoved
                ? destinationPlaceholder
                : null;
        },
        querySelectorAll(selector) {
            return selector === '.task-card' ? this.cards : [];
        },
        insertAdjacentHTML() {
            assert.fail('A non-empty destination must not receive an empty state');
        },
        appendChild(card) {
            this.cards.push(card);
            sourceList.cards = [];
        }
    };
    const card = {
        dataset: { id: 'task-1' },
        style: {},
        classList: {
            add() {},
            remove() {}
        },
        closest(selector) {
            return selector === '.column' ? sourceColumn : null;
        }
    };
    sourceList.cards = [card];

    globalThis.document = {
        querySelectorAll(selector) {
            return selector === '.column' ? [sourceColumn, destinationColumn] : [];
        }
    };
    viewManager.draggedTask = card;

    await viewManager.handleDrop({
        preventDefault() {},
        target: {
            closest(selector) {
                return selector === '.column' ? destinationColumn : null;
            }
        },
        dataTransfer: {
            getData() {
                return 'task-1';
            }
        }
    });

    assert.equal(destinationPlaceholderRemoved, true);
    assert.match(sourcePlaceholderHtml, /No tasks here/);
    assert.equal(sourceHeading.dataset.count, '0');
    assert.equal(destinationHeading.dataset.count, '1');
    assert.deepEqual(movedTasks, [{ taskId: 'task-1', status: 'in_progress' }]);
});
