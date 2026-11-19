import assert from 'node:assert/strict';
import test from 'node:test';

class FakeElement extends EventTarget {
    constructor(tagName = 'div') {
        super();
        this.tagName = tagName.toUpperCase();
        this.className = '';
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.innerHTML = '';
        this.textContent = '';
    }

    get parentElement() {
        return this.parentNode;
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        const index = this.children.indexOf(reference);
        if (index === -1) {
            throw new Error('Reference element is not a child');
        }
        child.parentNode = this;
        this.children.splice(index, 0, child);
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }

    remove() {
        this.parentNode?.removeChild(this);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    matches(selector) {
        if (selector.startsWith('.')) {
            return this.className.split(/\s+/).includes(selector.slice(1));
        }
        return this.tagName.toLowerCase() === selector.toLowerCase();
    }

    querySelector(selector) {
        for (const child of this.children) {
            if (child.matches(selector)) return child;
            const descendant = child.querySelector(selector);
            if (descendant) return descendant;
        }
        return null;
    }

    get classList() {
        return {
            add: (...names) => {
                const classes = new Set(this.className.split(/\s+/).filter(Boolean));
                names.forEach(name => classes.add(name));
                this.className = [...classes].join(' ');
            },
            contains: name => this.className.split(/\s+/).includes(name)
        };
    }

    get nextElementSibling() {
        if (!this.parentNode) return null;
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] ?? null;
    }
}

globalThis.document = {
    createElement(tagName) {
        return new FakeElement(tagName);
    }
};

const { HelpIntegration } = await import('../static/js/help-integration.js');

function createIntegration() {
    const openedDocuments = [];
    const integration = Object.create(HelpIntegration.prototype);
    integration.docsManager = {
        openDocument(docName) {
            openedDocuments.push(docName);
        }
    };
    return { integration, openedDocuments };
}

test('renders action help as a separate WDS button with one tooltip', () => {
    const { integration, openedDocuments } = createIntegration();
    const actionBar = new FakeElement('div');
    const action = new FakeElement('button');
    actionBar.appendChild(action);

    const helpButton = integration.addHelpIcon(
        action,
        'user-guide',
        'Filter tasks'
    );
    const actionGroup = action.parentElement;

    assert.equal(actionGroup.className, 'help-target');
    assert.deepEqual(actionGroup.children, [action, helpButton]);
    assert.equal(helpButton.tagName, 'BUTTON');
    assert.equal(helpButton.getAttribute('type'), 'button');
    assert.match(helpButton.className, /\bwds-btn\b/);
    assert.match(helpButton.className, /\bwds-btn--icon\b/);
    assert.equal(helpButton.getAttribute('data-wds-tooltip'), 'Filter tasks');
    assert.equal(
        helpButton.getAttribute('data-wds-tooltip-placement'),
        'bottom'
    );
    assert.equal(helpButton.getAttribute('title'), null);
    assert.equal(helpButton.textContent, '');
    assert.match(helpButton.innerHTML, /<wds-icon name="info" size="14">/);

    const click = new Event('click', { cancelable: true });
    helpButton.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    assert.deepEqual(openedDocuments, ['user-guide']);

    assert.equal(
        integration.addHelpIcon(action, 'user-guide', 'Filter tasks'),
        helpButton
    );
    assert.equal(
        actionGroup.children.filter(child => child.matches('.help-icon')).length,
        1
    );
});

test('places form help alongside the field label', () => {
    const { integration } = createIntegration();
    const field = new FakeElement('div');
    field.className = 'wds-field';
    const label = new FakeElement('label');
    const select = new FakeElement('select');
    field.appendChild(label);
    field.appendChild(select);

    const helpButton = integration.addHelpIcon(
        field,
        'user-guide',
        'Task type help'
    );

    assert.equal(label.children.at(-1), helpButton);
    assert.equal(helpButton.getAttribute('data-wds-tooltip-placement'), 'top');
    assert.equal(select.querySelector('.help-icon'), null);
});
