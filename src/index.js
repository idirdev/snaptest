'use strict';

/**
 * @fileoverview Snapshot testing utility for JSON data.
 * @module snaptest
 * @author idirdev
 */

const fs   = require('fs');
const path = require('path');

/**
 * @typedef {Object} DiffEntry
 * @property {string} path     - Dot-separated key path.
 * @property {*}      expected - Value in the stored snapshot.
 * @property {*}      actual   - Value in the new data.
 * @property {'added'|'removed'|'changed'} type - Type of difference.
 */

/**
 * @typedef {Object} MatchResult
 * @property {boolean}     pass    - Whether data matches the snapshot.
 * @property {string}      message - Human-readable result message.
 * @property {DiffEntry[]} [diff]  - Diff entries when pass is false.
 */

/**
 * Deterministically serialise a value using sorted keys.
 * @param {*} data
 * @returns {string}
 */
function serialize(data) {
  return JSON.stringify(data, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((acc, k) => {
        acc[k] = value[k];
        return acc;
      }, {});
    }
    return value;
  }, 2);
}

/**
 * Deserialise a JSON string.
 * @param {string} str
 * @returns {*}
 */
function deserialize(str) {
  return JSON.parse(str);
}

/**
 * Recursively compute the diff between two values.
 * @param {*}      a       - Expected (stored snapshot) value.
 * @param {*}      b       - Actual (new data) value.
 * @param {string} [prefix=''] - Current key path prefix.
 * @returns {DiffEntry[]}
 */
function diffObjects(a, b, prefix = '') {
  const diffs = [];

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const p = prefix ? `${prefix}.${key}` : key;
      if (!(key in a)) {
        diffs.push({ path: p, expected: undefined, actual: b[key], type: 'added' });
      } else if (!(key in b)) {
        diffs.push({ path: p, expected: a[key], actual: undefined, type: 'removed' });
      } else {
        diffs.push(...diffObjects(a[key], b[key], p));
      }
    }
  } else if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const p = `${prefix}[${i}]`;
      if (i >= a.length) {
        diffs.push({ path: p, expected: undefined, actual: b[i], type: 'added' });
      } else if (i >= b.length) {
        diffs.push({ path: p, expected: a[i], actual: undefined, type: 'removed' });
      } else {
        diffs.push(...diffObjects(a[i], b[i], p));
      }
    }
  } else if (serialize(a) !== serialize(b)) {
    const label = prefix || '(root)';
    diffs.push({ path: label, expected: a, actual: b, type: 'changed' });
  }

  return diffs;
}

/**
 * Format an array of diff entries into a human-readable string.
 * @param {DiffEntry[]} diffs
 * @returns {string}
 */
function formatDiff(diffs) {
  if (diffs.length === 0) return '(no differences)';
  return diffs.map((d) => {
    switch (d.type) {
      case 'added':   return `  + ${d.path}: ${JSON.stringify(d.actual)}`;
      case 'removed': return `  - ${d.path}: ${JSON.stringify(d.expected)}`;
      case 'changed': return `  ~ ${d.path}: ${JSON.stringify(d.expected)} → ${JSON.stringify(d.actual)}`;
      default:        return `  ? ${d.path}`;
    }
  }).join('\n');
}

/**
 * Create a snapshot manager bound to a directory.
 * @param {string} snapshotDir - Directory in which to store snapshots.
 * @returns {Object} Snapshot manager API.
 */
function createSnapshotManager(snapshotDir) {
  fs.mkdirSync(snapshotDir, { recursive: true });

  function _filePath(name) {
    return path.join(snapshotDir, `${name}.snap.json`);
  }

  /**
   * Compare data against a stored snapshot.
   * Creates the snapshot if it does not exist yet.
   * @param {string} name
   * @param {*}      data
   * @returns {MatchResult}
   */
  function matchSnapshot(name, data) {
    const fp = _filePath(name);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, serialize(data), 'utf8');
      return { pass: true, message: `Snapshot '${name}' created.` };
    }
    const stored  = deserialize(fs.readFileSync(fp, 'utf8'));
    const diffs   = diffObjects(stored, data);
    if (diffs.length === 0) {
      return { pass: true, message: `Snapshot '${name}' matches.` };
    }
    return {
      pass:    false,
      message: `Snapshot '${name}' does not match:\n${formatDiff(diffs)}`,
      diff:    diffs,
    };
  }

  /**
   * Overwrite a stored snapshot with new data.
   * @param {string} name
   * @param {*}      data
   * @returns {void}
   */
  function updateSnapshot(name, data) {
    fs.writeFileSync(_filePath(name), serialize(data), 'utf8');
  }

  /**
   * Delete a stored snapshot.
   * @param {string} name
   * @returns {boolean} True if deleted, false if it did not exist.
   */
  function deleteSnapshot(name) {
    const fp = _filePath(name);
    if (!fs.existsSync(fp)) return false;
    fs.unlinkSync(fp);
    return true;
  }

  /**
   * List the names of all stored snapshots.
   * @returns {string[]}
   */
  function listSnapshots() {
    return fs.readdirSync(snapshotDir)
      .filter((f) => f.endsWith('.snap.json'))
      .map((f)    => f.replace(/\.snap\.json$/, ''));
  }

  /**
   * Assert that data matches the named snapshot.
   * @param {string} name
   * @param {*}      data
   * @returns {MatchResult}
   */
  function toMatchSnapshot(name, data) {
    return matchSnapshot(name, data);
  }

  return { matchSnapshot, updateSnapshot, deleteSnapshot, listSnapshots, toMatchSnapshot };
}

module.exports = { createSnapshotManager, diffObjects, formatDiff, serialize, deserialize };
