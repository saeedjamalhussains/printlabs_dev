import User from '../auth/User.js';
import Order from '../orders/Order.js';
import Product from '../products/Product.js';
import AppError from '../../utils/AppError.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { setAuditChanges } from '../../middleware/auditMiddleware.js';
import { softDeleteUser } from '../auth/userService.js';
import { parsePaging, buildPagination, escapeRegex } from '../../utils/pagination.js';

// ─── Users ────────────────────────────────────────────────────────────

// @desc    Get users (paginated)
// @route   GET /api/admin/users
export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req);

  const query = {};
  if (req.query.role && ['customer', 'admin'].includes(req.query.role)) {
    query.role = req.query.role;
  }
  if (req.query.status && ['active', 'suspended', 'deleted'].includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.search) {
    const escaped = escapeRegex(req.query.search, 80);
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select('name email role isActive status phone createdAt')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: { users, pagination: buildPagination(total, { page, limit }) },
  });
});

// @desc    Get user detail
// @route   GET /api/admin/users/:id
export const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) return next(new AppError('User not found', 404));
  res.status(200).json({ success: true, data: { user } });
});

// @desc    Change user role
// @route   PUT /api/admin/users/:id/role
export const updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;
  if (!['customer', 'admin'].includes(role)) {
    return next(new AppError('Role must be either "customer" or "admin"', 400));
  }
  // Without this, an admin can demote themselves and lock the whole team
  // out of the dashboard, since there is no other way to grant the role.
  if (String(req.params.id) === String(req.user._id)) {
    return next(new AppError('You cannot change your own role', 400));
  }

  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found', 404));

  const from = user.role;
  if (from !== role) {
    user.role = role;
    // A role change alters what every outstanding token is allowed to do,
    // so existing sessions are invalidated and must sign in again.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
  }

  setAuditChanges(res, { targetUser: String(user._id), email: user.email, role: { from, to: role } });

  res.status(200).json({ success: true, data: { user: { ...user.toObject(), password: undefined } } });
});

// @desc    Activate/deactivate user
// @route   PUT /api/admin/users/:id/status
export const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return next(new AppError('`isActive` must be true or false', 400));
  }
  if (String(req.params.id) === String(req.user._id)) {
    return next(new AppError('You cannot deactivate your own account', 400));
  }

  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found', 404));

  const from = user.isActive;
  user.isActive = isActive;
  user.status = isActive ? 'active' : 'suspended';
  // A suspension has to take effect immediately, not whenever the
  // suspended user's current token happens to expire.
  if (!isActive) user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  setAuditChanges(res, {
    targetUser: String(user._id),
    email: user.email,
    isActive: { from, to: isActive },
  });

  res.status(200).json({ success: true, data: { user: { ...user.toObject(), password: undefined } } });
});

// @desc    Soft-delete a user
// @route   DELETE /api/admin/users/:id
export const deleteUser = asyncHandler(async (req, res, next) => {
  if (String(req.params.id) === String(req.user._id)) {
    return next(new AppError('You cannot delete your own account from the admin panel', 400));
  }

  const user = await User.findById(req.params.id).select('email name').lean();
  if (!user) return next(new AppError('User not found', 404));

  await softDeleteUser(req.params.id);

  setAuditChanges(res, { targetUser: String(req.params.id), email: user.email, name: user.name });

  res.status(200).json({ success: true, data: { message: 'User deleted' } });
});

// ─── Products ─────────────────────────────────────────────────────────

// @desc    Activate/deactivate product
// @route   PUT /api/admin/products/:id/status
export const updateProductStatus = asyncHandler(async (req, res, next) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return next(new AppError('`isActive` must be true or false', 400));
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true, projection: 'title isActive' }
  );
  if (!product) return next(new AppError('Product not found', 404));

  setAuditChanges(res, { productId: String(product._id), title: product.title, isActive });

  res.status(200).json({ success: true, data: { product } });
});

// @desc    Delete a product
// @route   DELETE /api/admin/products/:id
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).select('title').lean();
  if (!product) return next(new AppError('Product not found', 404));

  await Product.deleteOne({ _id: req.params.id });

  setAuditChanges(res, { productId: String(req.params.id), title: product.title });

  res.status(200).json({ success: true, data: { message: 'Product deleted' } });
});

// ─── Orders ───────────────────────────────────────────────────────────

// @desc    Delete an order
// @route   DELETE /api/admin/orders/:id
export const deleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .select('totalAmount orderStatus payment.status buyer.email')
    .lean();
  if (!order) return next(new AppError('Order not found', 404));

  // Deleting a paid order destroys the only record of a real transaction.
  // The audit trail keeps a copy, but the operation is still blocked
  // unless explicitly forced.
  if (order.payment?.status === 'paid' && req.query.force !== 'true') {
    return next(new AppError(
      'This order has a completed payment. Refund it first, or repeat the request with ?force=true.',
      400
    ));
  }

  await Order.deleteOne({ _id: req.params.id });

  setAuditChanges(res, {
    orderId: String(req.params.id),
    buyer: order.buyer?.email,
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    paymentStatus: order.payment?.status,
    forced: req.query.force === 'true',
  });

  res.status(200).json({ success: true, data: { message: 'Order deleted' } });
});

// ─── Analytics ────────────────────────────────────────────────────────

// @desc    Dashboard analytics
// @route   GET /api/admin/analytics
export const getAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Revenue used to be computed by loading every paid order into Node and
  // summing in JavaScript — three separate full-collection reads. This is
  // one aggregation that returns three numbers, so memory use is flat
  // regardless of how many orders exist.
  const revenuePipeline = Order.aggregate([
    { $match: { 'payment.status': 'paid' } },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
        thisMonth: {
          $sum: { $cond: [{ $gte: ['$createdAt', startOfThisMonth] }, '$totalAmount', 0] },
        },
        lastMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$createdAt', startOfLastMonth] },
                  { $lt: ['$createdAt', startOfThisMonth] },
                ],
              },
              '$totalAmount',
              0,
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const [revenueRows, statusRows, roleRows, totalOrders, totalProducts, lowStock, newThisMonth, recentOrders] =
    await Promise.all([
      revenuePipeline,
      Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Order.estimatedDocumentCount(),
      Product.estimatedDocumentCount(),
      Product.find({ stock: { $lt: 5 } }).select('title stock').limit(20).lean(),
      User.aggregate([
        { $match: { createdAt: { $gte: startOfThisMonth } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Order.find()
        .select('totalAmount orderStatus createdAt buyer payment.status user')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

  const revenue = revenueRows[0] || { total: 0, thisMonth: 0, lastMonth: 0 };
  const tally = (rows, seed) =>
    rows.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), { ...seed });

  const byStatus = tally(statusRows, {
    placed: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0,
  });
  const roleCounts = tally(roleRows, { customer: 0, admin: 0 });
  const newByRole = tally(newThisMonth, { customer: 0, admin: 0 });

  res.status(200).json({
    success: true,
    data: {
      revenue: {
        total: revenue.total,
        thisMonth: revenue.thisMonth,
        lastMonth: revenue.lastMonth,
      },
      orders: { total: totalOrders, byStatus },
      products: { total: totalProducts, lowStock },
      users: {
        total: roleCounts.customer + roleCounts.admin,
        customers: roleCounts.customer,
        team: roleCounts.admin,
        byRole: roleCounts,
        newCustomersThisMonth: newByRole.customer,
        newTeamThisMonth: newByRole.admin,
      },
      recentOrders,
    },
  });
});
