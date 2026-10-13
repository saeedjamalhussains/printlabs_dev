const PAYMENT_WORDS = [
  'payment', 'payments', 'pay', 'paying', 'paid', 'refund', 'refunds',
  'upi', 'gpay', 'phonepe', 'paytm', 'bank', 'banking', 'wallet', 'wallets',
  'transaction', 'transactions', 'billing', 'bill', 'billed', 'checkout',
  'invoice', 'invoices', 'gateway', 'razorpay', 'stripe', 'money',
  'charge', 'charged', 'cod', 'cvv', 'emi', 'upi-id',
];

const PAYMENT_PHRASES = [
  'credit card', 'debit card', 'card number', 'cash on delivery',
  'failed payment', 'net banking',
];

const WORD_PATTERN = new RegExp(`\\b(${PAYMENT_WORDS.join('|')})\\b`, 'i');

export const isPaymentQuery = (query = '') => {
  const normalized = String(query).toLowerCase();
  if (PAYMENT_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
  return WORD_PATTERN.test(normalized);
};

export default isPaymentQuery;
