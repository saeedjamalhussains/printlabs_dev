import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaymentQuery } from '../src/index.js';

test('detects direct payment terms', () => {
  assert.equal(isPaymentQuery('How do I pay for this poster?'), true);
  assert.equal(isPaymentQuery('What is my refund status?'), true);
});

test('detects payment phrases', () => {
  assert.equal(isPaymentQuery('Can I pay using a credit card?'), true);
  assert.equal(isPaymentQuery('Do you support net banking?'), true);
});

test('ignores non-payment queries', () => {
  assert.equal(isPaymentQuery('Which poster is best for a living room?'), false);
  assert.equal(isPaymentQuery('What do you stock in 24x36?'), false);
});
