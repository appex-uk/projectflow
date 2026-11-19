import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    getAllowedParentType,
    getEligibleParentTasks,
    TASK_CREATION_TYPES
} from '../static/js/task-hierarchy.js';

test('creation exposes only epic, story, and task types', () => {
    assert.deepEqual(TASK_CREATION_TYPES, ['epic', 'story', 'task']);
});

test('task types allow only the next level up as a parent', () => {
    assert.equal(getAllowedParentType('epic'), null);
    assert.equal(getAllowedParentType('story'), 'epic');
    assert.equal(getAllowedParentType('task'), 'story');
    assert.equal(getAllowedParentType('subtask'), null);
    assert.equal(getAllowedParentType('unknown'), null);
});

test('parent candidates are filtered by type and exclude the edited task', () => {
    const tasks = [
        { id: 'epic-1', title: 'Programme', type: 'epic' },
        { id: 'story-1', title: 'Checkout', type: 'story' },
        { id: 'story-2', title: 'Receipts', type: 'story' },
        { id: 'task-1', title: 'Add button', type: 'task' }
    ];

    assert.deepEqual(
        getEligibleParentTasks('story', tasks).map(task => task.id),
        ['epic-1']
    );
    assert.deepEqual(
        getEligibleParentTasks('task', tasks, 'story-2').map(task => task.id),
        ['story-1']
    );
    assert.deepEqual(getEligibleParentTasks('epic', tasks), []);
});

test('the task form includes a parent selector inside a type-selection menu', async () => {
    const template = await readFile(
        new URL('../templates/index.html', import.meta.url),
        'utf8'
    );

    assert.match(template, /<wds-menu-button id="new-task-menu"/);
    for (const type of TASK_CREATION_TYPES) {
        assert.match(template, new RegExp(`<wds-menu-item value="${type}">`));
    }
    assert.match(template, /id="task-parent-id" name="parent_id"/);
    assert.doesNotMatch(template, /<option value="subtask">/);
});

test('legacy form styles do not override WDS select geometry', async () => {
    const css = await readFile(
        new URL('../static/css/components/forms.css', import.meta.url),
        'utf8'
    );

    assert.doesNotMatch(
        css,
        /\.form-group select\s*\{/,
        'legacy modal select padding must not target WDS selects'
    );
    assert.doesNotMatch(
        css,
        /\.filter-group select\s*\{/,
        'legacy filter select padding must not target WDS selects'
    );
    assert.match(css, /\.form-group select:not\(\.wds-select\)/);
    assert.match(css, /\.filter-group select:not\(\.wds-select\)/);
});
