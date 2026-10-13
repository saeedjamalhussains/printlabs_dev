import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../hooks/useAuth';
import { degrade } from '../../utils/imageQuality';
import './Cart.css';

const Cart = () => {
  const { cart, removeFromCart, updateQty, totalAmount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    navigate('/checkout');
  };

  if (cart.length === 0) {
    return (
      <div className="cart-page container cart-empty">
        <ShoppingBag size={56} />
        <p className="cart-empty-eyebrow">Your bag is empty</p>
        <h2 className="cart-empty-title">Nothing on the wall</h2>
        <Link to="/shop" className="cart-empty-link">
          <span>Start browsing</span> <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page container">


      <div className="cart-grid">
        <ul className="cart-items">
          {cart.map((item) => (
            <li key={item._id} className="cart-row">
              {(() => {
                const src = item.imageUrl || item.images?.[0]?.url || '';
                return (
                  <div className="cart-row-img">
                    {src ? (
                      <img src={degrade(src, 'cart')} alt={item.title} />
                    ) : (
                      <div className="image-placeholder">No Image</div>
                    )}
                  </div>
                );
              })()}

              <div className="cart-row-meta">
                <p className="cart-row-cat">{item.category}</p>
                <h3 className="cart-row-title">{item.title}</h3>
                <p className="cart-row-price">₹{item.price}</p>
              </div>

              {/* The stepper is capped at available stock. It used to
                  increment freely; the context now clamps the value, so
                  without disabling the control the button would appear
                  live while doing nothing. */}
              <div className="cart-row-qty">
                <button onClick={() => updateQty(item._id, item.quantity - 1)} aria-label="Decrease">
                  <Minus size={12} />
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => updateQty(item._id, item.quantity + 1)}
                  aria-label="Increase"
                  disabled={Number.isFinite(Number(item.stock)) && item.quantity >= item.stock}
                  title={
                    Number.isFinite(Number(item.stock)) && item.quantity >= item.stock
                      ? `Only ${item.stock} in stock`
                      : undefined
                  }
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="cart-row-total">₹{item.price * item.quantity}</div>

              <button
                className="cart-row-remove"
                onClick={() => removeFromCart(item._id)}
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>

        <aside className="cart-summary">
          <p className="cart-summary-label">Summary</p>
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>₹{totalAmount}</span>
          </div>
          <div className="cart-summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <hr className="cart-summary-rule" aria-hidden="true" />
          <div className="cart-summary-row cart-summary-total">
            <span>Total</span>
            <span>₹{totalAmount}</span>
          </div>
          <button className="cart-summary-cta" onClick={handleCheckout}>
            <span>{user ? 'Checkout' : 'Sign in to checkout'}</span> <ArrowRight size={16} />
          </button>
          {!user && (
            <p className="cart-summary-hint">
              An account is required to place an order.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Cart;
