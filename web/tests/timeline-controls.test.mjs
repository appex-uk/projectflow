import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const templateURL = new URL('../templates/index.html', import.meta.url);
const timelineCSSURL = new URL('../static/css/views/timeline.css', import.meta.url);

test('timeline controls use matching WDS control sizes', async () => {
    const [template, css] = await Promise.all([
        readFile(templateURL, 'utf8'),
        readFile(timelineCSSURL, 'utf8')
    ]);

    assert.match(
        template,
        /id="timeline-today-btn"\s+class="[^"]*\bwds-btn\b[^"]*"\s+type="button"/,
        'Today should use the standard-height WDS button'
    );
    assert.doesNotMatch(
        template,
        /id="timeline-today-btn"\s+class="[^"]*\bwds-btn--sm\b/,
        'a small button should not be mixed with standard-height selects'
    );
    assert.doesNotMatch(
        css,
        /\.timeline-controls\s+(?:select|button)[^{]*\{[^}]*padding:/s,
        'legacy padding should not override WDS control geometry'
    );
});
