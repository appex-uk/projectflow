import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssURL = new URL('../static/css/product.css', import.meta.url);

function ruleBody(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(
        new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([^}]+)\\}`)
    )?.[1] ?? '';
}

test('selected project item keeps readable themed text', async () => {
    const css = await readFile(cssURL, 'utf8');

    assert.match(
        ruleBody(css, '.project-item.selected .project-item-name'),
        /color:\s*var\(--wds-text\)/
    );
    assert.match(
        ruleBody(css, '.project-item.selected .project-item-description'),
        /color:\s*var\(--wds-text-muted\)/
    );
});

test('project switcher uses compact trigger and room for both footer actions', async () => {
    const css = await readFile(cssURL, 'utf8');
    const trigger = ruleBody(css, '.project-selector-btn');
    const dropdown = ruleBody(css, '.project-dropdown');

    assert.match(
        trigger,
        /height:\s*var\(--wds-icon-button-size\)/,
        'the trigger should use the standard WDS button height'
    );
    assert.match(
        trigger,
        /padding-block:\s*0/,
        'legacy vertical padding should not make the trigger taller'
    );
    assert.match(
        dropdown,
        /width:\s*min\([\s\S]+--wds-sidenav-width/,
        'the desktop dropdown should be wider than the sidebar control'
    );
    assert.match(
        css,
        /\.project-dropdown-footer\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
        'footer columns should shrink within the available width'
    );
    assert.match(
        css,
        /@media \(max-width: 520px\)[\s\S]*?\.project-dropdown-footer\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
        'narrow drawers should stack the project actions'
    );
});
