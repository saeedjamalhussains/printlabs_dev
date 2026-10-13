import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCategories, normalizeCategories } from '../src/index.js';

test('splits and de-dupes category labels', () => {
  assert.deepEqual(splitCategories('Art, art, Minimal, Modern'), ['Art', 'Minimal', 'Modern']);
  assert.equal(normalizeCategories('Art,  Minimal,Modern '), 'Art, Minimal, Modern');
});

test('ignores blanks and preserves first spelling', () => {
  assert.deepEqual(splitCategories(' ,  Travel, travel , Nature '), ['Travel', 'Nature']);
});
