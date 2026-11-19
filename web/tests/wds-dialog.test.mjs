import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dialogComponents = [
    ['modal', '../../wds/components/modal/wds-modal.js'],
    ['drawer', '../../wds/components/drawer/wds-drawer.js']
];

for (const [name, relativePath] of dialogComponents) {
    test(`${name} is hidden while closed and becomes a flex layout when open`, async () => {
        const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');

        assert.match(
            source,
            /dialog:not\(\[open\]\)\s*\{[^}]*display:\s*none;/,
            'closed native dialogs must not participate in page layout'
        );
        assert.match(
            source,
            /dialog\[open\]\s*\{[^}]*display:\s*flex;/,
            'open native dialogs should retain their flex layout'
        );
    });
}
