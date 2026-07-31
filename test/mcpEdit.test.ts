import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMcpServers,
  replaceMcpServers,
  presetDocument,
  serversEqual,
} from '../src/mcpEdit';

const DOC = `{
  // top-of-file comment
  "someOtherKey": { "keep": true },
  "mcpServers": {
    "alpha": { "command": "npx", "args": ["a"] },
    "beta": { "url": "https://b" }
  }
}`;

test('extractMcpServers returns the servers object', () => {
  const s = extractMcpServers(DOC);
  assert.deepEqual(Object.keys(s).sort(), ['alpha', 'beta']);
});

test('replaceMcpServers swaps only the mcpServers block, preserving other keys and comments', () => {
  const out = replaceMcpServers(DOC, { solo: { url: 'https://solo' } });
  const root = JSON.parse(out.replace(/^\s*\/\/.*$/gm, ''));
  // only the new single server remains
  assert.deepEqual(Object.keys(root.mcpServers), ['solo']);
  assert.equal(root.mcpServers.solo.url, 'https://solo');
  // other top-level key preserved
  assert.equal(root.someOtherKey.keep, true);
  // top-of-file comment preserved
  assert.ok(out.includes('top-of-file comment'));
});

test('replaceMcpServers can empty the block (single-endpoint isolation edge case)', () => {
  const out = replaceMcpServers(DOC, {});
  const root = JSON.parse(out.replace(/^\s*\/\/.*$/gm, ''));
  assert.deepEqual(root.mcpServers, {});
});

test('presetDocument wraps servers in a valid mcp.json shape', () => {
  const txt = presetDocument({ alpha: { command: 'x' } });
  const root = JSON.parse(txt);
  assert.equal(root.mcpServers.alpha.command, 'x');
});

test('serversEqual is order-independent', () => {
  const a = { x: { a: 1, b: 2 }, y: { c: 3 } };
  const b = { y: { c: 3 }, x: { b: 2, a: 1 } };
  assert.equal(serversEqual(a, b), true);
});

test('serversEqual detects real differences', () => {
  assert.equal(serversEqual({ x: { a: 1 } }, { x: { a: 2 } }), false);
  assert.equal(serversEqual({ x: {} }, { x: {}, y: {} }), false);
});

test('round-trip: extract from one doc, replace into another', () => {
  const preset = presetDocument(extractMcpServers(DOC));
  const target = `{\n  "mcpServers": {}\n}`;
  const out = replaceMcpServers(target, extractMcpServers(preset));
  assert.deepEqual(Object.keys(JSON.parse(out).mcpServers).sort(), ['alpha', 'beta']);
});
