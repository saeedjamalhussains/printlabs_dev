import test from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../src/index.js';

test('merges conflicting Tailwind classes by keeping later values', () => {
  assert.equal(cn('bg-red-500 text-white', 'text-black'), 'bg-red-500 text-black');
  assert.equal(cn('p-2 p-4'), 'p-4');
});
