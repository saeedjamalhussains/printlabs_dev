import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Checkout.css';

const Checkout = () => {
  const { cart, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (cart.length === 0) navigate('/cart', { replace: true });
  }, [cart, navigate]);

  const [address, setAddress] = useState({
    name: user?.name || '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
  });

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const { data } = await api.post('/coupons/validate', {
        code: couponCode,
        subtotal: totalAmount,
      });
      setAppliedCoupon(data.data);
      setCouponError('');
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.message || 'Failed to apply coupon.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  let discount = 0;
  if (appliedCoupon) {
    discount = appliedCoupon.discount || 0;
  }
  const finalAmount = totalAmount - discount;

  const handleChange = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePayment = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const ok = await loadRazorpay();
      if (!ok) {
        setError('Payment SDK failed to load. Check your connection.');
        setLoading(false);
        return;
      }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        setError('Payments are not configured. Please contact support.');
        setLoading(false);
        return;
      }

      // The server prices the basket itself and returns the amount it will
      // charge — it no longer accepts an amount from the browser, so a
      // tampered total simply cannot reach Razorpay.
      const orderItems = cart.map((item) => ({
        product: item._id,
        quantity: item.quantity,
        size: item.size,
      }));

      const { data: createRes } = await api.post('/orders/create-razorpay-order', {
        items: orderItems,
        couponCode: appliedCoupon?.code || undefined,
      });
      const rzpOrder = createRes.data;

      const options = {
        key: razorpayKey,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'ThePrintLabs',
        description: 'Premium Poster Purchase',
        order_id: rzpOrder.id,
        handler: async (response) => {
          try {
            const { data: verifyRes } = await api.post('/orders/verify-payment', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              // Must be byte-identical to the basket sent at intent time:
              // the server fingerprints it and rejects any mismatch.
              items: orderItems,
              shippingAddress: {
                name: address.name,
                phone: address.phone,
                street: address.address,
                city: address.city,
                pincode: address.pincode,
              },
              couponCode: appliedCoupon?.code || undefined,
            });
            clearCart();
            setLoading(false);
            navigate('/order-success', { state: { orderId: verifyRes.data.orderId } });
          } catch (err) {
            setLoading(false);
            setError(err?.response?.data?.message || 'Payment verification failed. Please try again.');
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        prefill: { name: address.name, email: user.email, contact: address.phone },
        // Match the site's strict B/W palette inside Razorpay's overlay.
        theme: { color: '#000000' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setError(response?.error?.description || 'Payment failed. Please try a different method.');
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || 'Checkout initialization failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="checkout-page container">


      {error && <div className="checkout-error">{error}</div>}

      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={handlePayment}>
          <p className="checkout-form-label">Delivery Address</p>

          <div className="checkout-row">
            <div className="checkout-field">
              <label>Full Name</label>
              <input name="name" value={address.name} onChange={handleChange} required />
            </div>
            <div className="checkout-field">
              <label>Phone</label>
              <input name="phone" value={address.phone} onChange={handleChange} required />
            </div>
          </div>

          <div className="checkout-field">
            <label>Street Address</label>
            <textarea name="address" rows="3" value={address.address} onChange={handleChange} required />
          </div>

          <div className="checkout-row">
            <div className="checkout-field">
              <label>City</label>
              <input name="city" value={address.city} onChange={handleChange} required />
            </div>
            <div className="checkout-field">
              <label>Pincode</label>
              <input name="pincode" value={address.pincode} onChange={handleChange} required />
            </div>
          </div>

          <button type="submit" className="checkout-cta" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="checkout-spinner" size={16} /> Processing…
              </>
            ) : (
              <>
                <span>Pay ₹{finalAmount}</span> <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <aside className="checkout-review">
          <p className="checkout-review-label">Order Review</p>
          <ul className="checkout-review-items">
            {cart.map(item => (
              <li key={item._id}>
                <span className="ri-title">{item.title}</span>
                <span className="ri-qty">× {item.quantity}</span>
                <span className="ri-price">₹{item.price * item.quantity}</span>
              </li>
            ))}
          </ul>
          
          <div className="checkout-coupon-section">
            {appliedCoupon ? (
              <div className="checkout-coupon-applied">
                <span className="cca-text">COUPON APPLIED: <strong>{appliedCoupon.code}</strong> (₹{appliedCoupon.discount} OFF)</span>
                <button type="button" className="cca-remove" onClick={handleRemoveCoupon}>REMOVE</button>
              </div>
            ) : (
              <form className="checkout-coupon-form" onSubmit={handleApplyCoupon}>
                <input
                  type="text"
                  placeholder="COUPON CODE"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={couponLoading}
                />
                <button type="submit" className="coupon-apply-btn" disabled={couponLoading || !couponCode.trim()}>
                  {couponLoading ? '...' : 'APPLY'}
                </button>
              </form>
            )}
            {couponError && <p className="checkout-coupon-error">{couponError}</p>}
          </div>

          <hr className="checkout-review-rule" aria-hidden="true" />
          
          {discount > 0 && (
            <div className="checkout-review-discount">
              <span>DISCOUNT</span>
              <span>-₹{discount}</span>
            </div>
          )}

          <div className="checkout-review-total">
            <span>Total</span>
            <span>₹{finalAmount}</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
