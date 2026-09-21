import test from 'node:test';
import assert from 'node:assert/strict';
import { loadView } from '../../src/services/navigationLoading.js';

class Element extends EventTarget {
    children = [];
    attributes = new Map();
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    get firstElementChild() { return this.children[0] || null; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
const setup = () => {
    const document = new EventTarget();
    document.body = new Element();
    document.createElement = () => new Element();
    globalThis.document = document;
    const container = new Element();
    container.append(new Element());
    return { container, document, original: container.firstElementChild };
};
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const renderPage = (container, page) => context => {
    if (context.beforeRender()) container.children = [page];
};

test('a slow import preserves the current page and only the latest destination renders', async () => {
    const {container, original} = setup();
    const slow = deferred();
    let cleanups = 0;
    const first = loadView(container, () => slow.promise, {beforeRender: () => cleanups++});
    assert.equal(container.firstElementChild, original);
    assert.equal(cleanups, 0);
    const latest = new Element();
    assert.equal(await loadView(container, async () => renderPage(container, latest)), true);
    slow.resolve(renderPage(container, new Element()));
    assert.equal(await first, false);
    assert.equal(container.firstElementChild, latest);
    assert.equal(container.getAttribute('aria-busy'), null);
    assert.equal(cleanups, 0);
});

test('an old completion cannot clear the busy state of a newer pending request', async () => {
    const {container} = setup();
    const firstGate = deferred(), secondGate = deferred();
    const first = loadView(container, () => firstGate.promise);
    const second = loadView(container, () => secondGate.promise);
    firstGate.resolve(renderPage(container, new Element()));
    await first;
    assert.equal(container.getAttribute('aria-busy'), 'true');
    secondGate.resolve(renderPage(container, new Element()));
    await second;
    assert.equal(container.getAttribute('aria-busy'), null);
});

test('late profile-style data cannot replace a page opened while it was loading', async () => {
    const {container} = setup();
    const data = deferred();
    const old = loadView(container, async () => async context => {
        await data.promise;
        renderPage(container, new Element())(context);
    });
    await Promise.resolve();
    const latest = new Element();
    await loadView(container, async () => renderPage(container, latest));
    data.resolve();
    assert.equal(await old, false);
    assert.equal(container.firstElementChild, latest);
});

test('an import failure keeps the page and provides a dismissible error', async t => {
    const {container, document, original} = setup();
    t.mock.method(console, 'warn', () => {});
    assert.equal(await loadView(container, async () => { throw new Error('Offline'); }), false);
    assert.equal(container.firstElementChild, original);
    assert.equal(container.getAttribute('aria-busy'), null);
    assert.equal(document.body.firstElementChild.getAttribute('role'), 'alert');
    await loadView(container, async () => renderPage(container, new Element()));
    assert.equal(document.body.children.length, 0);
});

test('cancelling a slow load restores the page and ignores its eventual response', {timeout: 1500}, async () => {
    const {container, document, original} = setup();
    const gate = deferred();
    const result = loadView(container, () => gate.promise);
    await new Promise(resolve => setTimeout(resolve, 180));
    const notice = document.body.firstElementChild;
    assert.equal(notice.getAttribute('role'), 'status');
    notice.children.at(-1).onclick();
    assert.equal(container.getAttribute('aria-busy'), null);
    assert.equal(document.body.children.length, 0);
    assert.equal(await result, false);
    gate.resolve(renderPage(container, new Element()));
    await Promise.resolve();
    assert.equal(container.firstElementChild, original);
});

test('direct page changes invalidate an older pending import', async () => {
    const {container} = setup();
    const gate = deferred();
    const result = loadView(container, () => gate.promise);
    const newPage = new Element();
    container.children = [newPage];
    gate.resolve(renderPage(container, new Element()));
    assert.equal(await result, false);
    assert.equal(container.firstElementChild, newPage);
});
