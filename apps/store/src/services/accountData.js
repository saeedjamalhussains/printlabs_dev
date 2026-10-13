// Export only customer-facing fields. Never copy a raw user/session response.
export async function collectAccountData(client) {
  const { data } = await client.get('/auth/me');
  const user = data.data.user;
  const orders = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const response = await client.get('/orders/my-orders', { params: { page, limit: 100 } });
    const result = response.data.data;
    for (const order of result.orders) {
      orders.push({ id: order._id, placedAt: order.createdAt, status: order.orderStatus, total: order.totalAmount, discount: order.discountApplied, coupon: order.couponCode, paymentStatus: order.payment?.status, items: order.items.map(item => ({ title: item.title, quantity: item.quantity, price: item.price })) });
    }
    hasNext = Boolean(result.pagination?.hasNext);
    page += 1;
  }
  return { exportedAt: new Date().toISOString(), scope: 'Saved profile and order summaries available in your account. Not a complete personal-data access response.', profile: { name: user.name, email: user.email, phone: user.phone, address: { street: user.address?.street, city: user.address?.city, state: user.address?.state, pincode: user.address?.pincode } }, orders };
}
