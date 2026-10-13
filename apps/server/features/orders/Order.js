import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: String,        // Snapshot at purchase time
        imageUrl: String,     // Snapshot at purchase time
        size: String,
        price: Number,        // Final price at purchase time
        quantity: Number
      }
    ],
    buyer: {
      name: String,
      email: String
    },
    shippingAddress: {
      name: String,
      phone: String,
      street: String,
      city: String,
      state: String,
      pincode: String
    },
    totalAmount: { type: Number, required: true },
    couponCode: String,
    discountApplied: { type: Number, default: 0 },
    payment: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      // Amount actually collected, in paise, as reported by Razorpay.
      // Stored so a payment can be reconciled against the order total
      // without calling out to Razorpay again.
      amountPaid: Number,
      status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
      },
      paidAt: Date,
      // Refund metadata (admin-initiated via /api/admin/orders/:id/refund).
      refundId: String,
      refundedAt: Date,
      refundAmount: Number, // in paise, matching Razorpay's convention
      refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      refundReason: String,
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'placed'
    },
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
  },
  {
    timestamps: true, // handles createdAt
  }
);

// ─── Indexes, matched to the queries that actually run ───
// "my orders", newest first.
orderSchema.index({ user: 1, createdAt: -1 });
// Admin list, newest first, with optional status filters. The compound
// index covers both the filtered and unfiltered sorts.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
// Analytics aggregates revenue over paid orders within a date window.
orderSchema.index({ 'payment.status': 1, createdAt: -1 });
// Unique per Razorpay order — this is the database-level replay guard for
// payment verification, independent of the application-level check.
orderSchema.index({ 'payment.razorpayOrderId': 1 }, { unique: true, sparse: true });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
