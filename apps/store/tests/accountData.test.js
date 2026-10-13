import test from 'node:test';
import assert from 'node:assert/strict';
import { collectAccountData } from '../src/services/accountData.js';

const user = { name: 'Test Customer', email: 'customer@example.test', phone: '0000000000', address: { street: 'Test street', city: 'Test city' }, password: 'SECRET_HASH', token: 'SECRET_TOKEN', originalEmailHash: 'SECRET_EMAIL_HASH', tokenVersion: 7 };
const order = id => ({ _id: id, orderStatus: 'paid', totalAmount: 250, payment: { status: 'paid', razorpayPaymentId: 'INTERNAL_PAYMENT_ID' }, items: [{ title: 'Test print', quantity: 1, price: 250 }] });

test('downloads every page and excludes session, password and internal payment fields', async () => {
  const pages = [];
  const client = { get: async (path, options) => {
    if (path === '/auth/me') return { data: { data: { user } } };
    const page = options.params.page; pages.push(page);
    return { data: { data: { orders: [order(String(page))], pagination: { hasNext: page < 3 } } } };
  } };
  const result = await collectAccountData(client);
  assert.deepEqual(pages, [1, 2, 3]);
  assert.deepEqual(result.orders.map(item => item.id), ['1', '2', '3']);
  assert.equal(result.profile.address.street, 'Test street');
  assert.doesNotMatch(JSON.stringify(result), /SECRET_|INTERNAL_PAYMENT_ID|tokenVersion/);
});

test('fails instead of returning a partial export when a later page fails', async () => {
  const client = { get: async (path, options) => {
    if (path === '/auth/me') return { data: { data: { user } } };
    if (options.params.page === 2) throw new Error('Network unavailable');
    return { data: { data: { orders: [order('1')], pagination: { hasNext: true } } } };
  } };
  await assert.rejects(collectAccountData(client), /Network unavailable/);
});

test('supports accounts without an address or any orders', async () => {
  const client = { get: async path => path === '/auth/me' ? { data: { data: { user: { name: 'New customer', email: 'new@example.test' } } } } : { data: { data: { orders: [], pagination: { hasNext: false } } } } };
  const result = await collectAccountData(client);
  assert.deepEqual(result.orders, []);
  assert.equal(result.profile.name, 'New customer');
});
