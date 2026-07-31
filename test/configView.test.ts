import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSensitiveKey,
  maskString,
  isLeaf,
  childEntries,
  leafDisplay,
  branchHint,
} from '../src/configView';

test('isSensitiveKey matches common secret-bearing keys (case-insensitive)', () => {
  for (const k of ['Authorization', 'API_KEY', 'token', 'clientSecret', 'x-access-key', 'PASSWORD']) {
    assert.equal(isSensitiveKey(k), true, k);
  }
});

test('isSensitiveKey ignores non-secret keys', () => {
  for (const k of ['command', 'args', 'url', 'type', 'disabled', 'env', 'headers']) {
    assert.equal(isSensitiveKey(k), false, k);
  }
});

test('isLeaf distinguishes primitives from objects/arrays', () => {
  assert.equal(isLeaf('x'), true);
  assert.equal(isLeaf(3), true);
  assert.equal(isLeaf(false), true);
  assert.equal(isLeaf(null), true);
  assert.equal(isLeaf({}), false);
  assert.equal(isLeaf([]), false);
});

test('childEntries lists object keys and array indices', () => {
  assert.deepEqual(childEntries({ a: 1, b: 2 }), [
    { key: 'a', value: 1 },
    { key: 'b', value: 2 },
  ]);
  assert.deepEqual(childEntries(['x', 'y']), [
    { key: '0', value: 'x' },
    { key: '1', value: 'y' },
  ]);
  assert.deepEqual(childEntries('leaf'), []);
});

test('leafDisplay masks sensitive strings only when mask is on', () => {
  assert.equal(leafDisplay('Bearer abc123', true, true), maskString('Bearer abc123'));
  assert.equal(leafDisplay('Bearer abc123', true, false), 'Bearer abc123');
  assert.equal(leafDisplay('npx', false, true), 'npx');
});

test('maskString does not leak length or content', () => {
  const m = maskString('supersecrettoken');
  assert.equal(m, '••••••');
  assert.ok(!m.includes('secret'));
});

test('leafDisplay renders non-string primitives', () => {
  assert.equal(leafDisplay(false, false, true), 'false');
  assert.equal(leafDisplay(42, false, true), '42');
  assert.equal(leafDisplay(null, false, true), 'null');
});

test('branchHint summarizes objects and arrays', () => {
  assert.equal(branchHint({ a: 1, b: 2 }), '{2}');
  assert.equal(branchHint(['x']), '[1]');
  assert.equal(branchHint('leaf'), '');
});
