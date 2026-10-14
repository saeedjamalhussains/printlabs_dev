import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assistantChatRequestSchema,
  assistantChatResponseSchema,
  chatApiResponseSchema,
  productSchema,
} from '../src/index.js';

test('validates Fabi chat requests', () => {
  assert.equal(assistantChatRequestSchema.safeParse({ query: '  find a space poster  ' }).success, true);
  assert.equal(assistantChatRequestSchema.safeParse({ query: '  ' }).success, false);
  assert.equal(assistantChatRequestSchema.safeParse({ query: 'x'.repeat(501) }).success, false);
});

test('validates Fabi chat responses and product fields', () => {
  const response = {
    answer: 'Here are a few options.',
    products: [{ _id: 'product-id', title: 'Space Poster', price: 299, stock: 4 }],
  };
  assert.equal(assistantChatResponseSchema.safeParse(response).success, true);
  assert.equal(assistantChatResponseSchema.safeParse({ answer: 'No products', products: [null] }).success, false);
});

test('validates the wrapped Fabi response returned to the storefront', () => {
  assert.equal(chatApiResponseSchema.safeParse({
    success: true,
    data: {
      id: 'reply-id',
      sender: 'bot',
      timestamp: '10:30 AM',
      text: 'Here are a few options.',
      products: [{ title: 'Space Poster', price: 299 }],
      suggestions: ['More like space'],
    },
  }).success, true);
  assert.equal(chatApiResponseSchema.safeParse({ success: false, data: {} }).success, false);
});

test('validates the public product API shape', () => {
  assert.equal(productSchema.safeParse({
    _id: 'product-id',
    title: 'Space Poster',
    description: 'A framed view of the stars.',
    price: 299,
    category: 'Space',
    images: [{ url: 'https://example.test/poster.webp', variants: { w400: 'https://example.test/w400.webp' } }],
    stock: 5,
    sizes: [{ label: 'A3', priceModifier: 20 }],
  }).success, true);
  assert.equal(productSchema.safeParse({ title: 'Space Poster', price: -1 }).success, false);
});
