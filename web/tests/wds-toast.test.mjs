import assert from 'node:assert/strict';
import test from 'node:test';

class FakeElement extends EventTarget {
    constructor(tagName = 'div') {
        super();
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.className = '';
        this.textContent = '';
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = value;
        this.children = [];
        const classNames = new Set(
            [...value.matchAll(/class="([^"]+)"/g)]
                .flatMap(match => match[1].split(/\s+/))
                .filter(Boolean)
        );
        classNames.forEach(className => {
            const child = new FakeElement('div');
            child.className = className;
            this.appendChild(child);
        });
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(child) {
        if (child instanceof FakeFragment) {
            [...child.children].forEach(fragmentChild => this.appendChild(fragmentChild));
            return child;
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }

    querySelector(selector) {
        const [first, ...rest] = this.descendants();
        const candidates = [first, ...rest].filter(Boolean);
        return candidates.find(element => element.matches(selector)) || null;
    }

    descendants() {
        return this.children.flatMap(child => [child, ...child.descendants()]);
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
        if (selector.includes(':not([position])')) {
            return this.tagName.toLowerCase() === selector.split(':')[0] && !this.hasAttribute('position');
        }
        if (selector.includes('[position=')) {
            const tagName = selector.split('[')[0];
            const position = selector.match(/\[position="([^"]+)"\]/)?.[1];
            return this.tagName.toLowerCase() === tagName && this.getAttribute('position') === position;
        }
        return this.tagName.toLowerCase() === selector;
    }

    click() {
        this.dispatchEvent(new Event('click'));
    }

    attachShadow() {
        this.shadowRoot = new FakeShadowRoot();
        return this.shadowRoot;
    }
}

class FakeFragment {
    constructor(children = []) {
        this.children = children;
    }
}

class FakeShadowRoot extends FakeElement {
    constructor() {
        super('#shadow-root');
    }
}

class FakeTemplate extends FakeElement {
    constructor() {
        super('template');
        this.content = {
            cloneNode: () => new FakeFragment([new FakeElement('div')])
        };
    }

    set innerHTML(value) {
        this._innerHTML = value;
        const stack = new FakeElement('div');
        stack.className = 'stack';
        this.content = {
            cloneNode: () => new FakeFragment([stack])
        };
    }
}

class FakeBody extends FakeElement {
    constructor() {
        super('body');
    }
}

const registry = new Map();
globalThis.HTMLElement = FakeElement;
globalThis.customElements = {
    define(name, constructor) {
        registry.set(name, constructor);
    }
};
globalThis.document = {
    body: new FakeBody(),
    createElement(tagName) {
        if (tagName === 'template') return new FakeTemplate();
        const Constructor = registry.get(tagName);
        if (Constructor) {
            const element = new Constructor();
            element.tagName = tagName.toUpperCase();
            return element;
        }
        return new FakeElement(tagName);
    },
    querySelector(selector) {
        return document.body.children.flatMap(element => [element, ...element.descendants()])
            .find(element => element.matches(selector)) || null;
    }
};
globalThis.window = globalThis;

const toastModule = await import(
    new URL('../../wds/components/toast/wds-toast.js', import.meta.url)
);

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

test('toast markup is rendered inside the component and can be dismissed', async () => {
    toastModule.toast.info('Theme updated', { duration: 0 });

    const container = document.querySelector('wds-toast-container');
    assert.ok(container, 'toast container should be created');

    const toast = container.shadowRoot.querySelector('.toast');
    assert.ok(toast, 'toast should be inside the shadow root so component styles apply');

    toast.querySelector('.close').click();
    await wait(260);

    assert.equal(container.shadowRoot.querySelector('.toast'), null);
});

test('toast automatically disappears after its configured duration', async () => {
    toastModule.toast.success('Project created', { duration: 10 });
    const container = document.querySelector('wds-toast-container');

    assert.ok(container.shadowRoot.querySelector('.toast'));
    await wait(280);
    assert.equal(container.shadowRoot.querySelector('.toast'), null);
});
