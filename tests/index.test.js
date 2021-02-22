'use strict';

/**
 * @fileoverview Tests for snaptest.
 * @author idirdev
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const {
  createSnapshotManager,
  diffObjects,
  formatDiff,
  serialize,
  deserialize,
} = require('../src/index.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snaptest-'));
}

// ── serialize ──────────────────────────────────────────────────────────────
describe('serialize', () => {
  it('produces deterministic output regardless of key order', () => {
    const a = serialize({ b: 2, a: 1 });
    const b = serialize({ a: 1, b: 2 });
    assert.equal(a, b);
  });

  it('round-trips through deserialize', () => {
    const data = { x: [1, 2, 3], y: { z: true } };
    assert.deepEqual(deserialize(serialize(data)), data);
  });
});

// ── diffObjects ────────────────────────────────────────────────────────────
describe('diffObjects', () => {
  it('returns empty array for identical objects', () => {
    assert.deepEqual(diffObjects({ a: 1 }, { a: 1 }), []);
  });

  it('detects a changed value', () => {
    const diffs = diffObjects({ a: 1 }, { a: 2 });
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0].type, 'changed');
    assert.equal(diffs[0].path, 'a');
  });

  it('detects an added key', () => {
    const diffs = diffObjects({}, { newKey: 'val' });
    assert.equal(diffs[0].type, 'added');
    assert.equal(diffs[0].actual, 'val');
  });

  it('detects a removed key', () => {
    const diffs = diffObjects({ gone: true }, {});
    assert.equal(diffs[0].type, 'removed');
  });

  it('recurses into nested objects', () => {
    const diffs = diffObjects({ a: { b: 1 } }, { a: { b: 2 } });
    assert.equal(diffs[0].path, 'a.b');
  });

  it('handles array differences', () => {
    const diffs = diffObjects([1, 2], [1, 3]);
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0].type, 'changed');
  });
});

// ── formatDiff ─────────────────────────────────────────────────────────────
describe('formatDiff', () => {
  it('returns placeholder for empty diff', () => {
    assert.equal(formatDiff([]), '(no differences)');
  });

  it('includes path and type marker', () => {
    const out = formatDiff([{ path: 'x', expected: 1, actual: 2, type: 'changed' }]);
    assert.ok(out.includes('x'));
    assert.ok(out.includes('~'));
  });
});

// ── createSnapshotManager ──────────────────────────────────────────────────
describe('createSnapshotManager', () => {
  let dir, sm;
  before(() => { dir = tempDir(); sm = createSnapshotManager(dir); });
  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates a snapshot on first call', () => {
    const r = sm.matchSnapshot('first', { val: 1 });
    assert.equal(r.pass, true);
    assert.ok(r.message.includes('created'));
  });

  it('matches an identical snapshot', () => {
    sm.matchSnapshot('eq', { x: 42 });
    const r = sm.matchSnapshot('eq', { x: 42 });
    assert.equal(r.pass, true);
  });

  it('detects a mismatch', () => {
    sm.matchSnapshot('mis', { v: 'a' });
    const r = sm.matchSnapshot('mis', { v: 'b' });
    assert.equal(r.pass, false);
    assert.ok(Array.isArray(r.diff));
    assert.equal(r.diff.length, 1);
  });

  it('updateSnapshot overwrites stored data', () => {
    sm.matchSnapshot('upd', { v: 1 });
    sm.updateSnapshot('upd', { v: 2 });
    const r = sm.matchSnapshot('upd', { v: 2 });
    assert.equal(r.pass, true);
  });

  it('deleteSnapshot removes the file', () => {
    sm.matchSnapshot('del', { d: true });
    const removed = sm.deleteSnapshot('del');
    assert.equal(removed, true);
    assert.equal(sm.deleteSnapshot('del'), false);
  });

  it('listSnapshots returns stored names', () => {
    const d2 = tempDir();
    const sm2 = createSnapshotManager(d2);
    sm2.matchSnapshot('alpha', { a: 1 });
    sm2.matchSnapshot('beta',  { b: 2 });
    const list = sm2.listSnapshots();
    assert.ok(list.includes('alpha'));
    assert.ok(list.includes('beta'));
    fs.rmSync(d2, { recursive: true, force: true });
  });

  it('toMatchSnapshot delegates to matchSnapshot', () => {
    const r = sm.toMatchSnapshot('delegate', { ok: true });
    assert.equal(typeof r.pass, 'boolean');
  });
});
