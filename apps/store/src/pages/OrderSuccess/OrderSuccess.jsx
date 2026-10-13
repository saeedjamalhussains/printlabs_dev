import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import './OrderSuccess.css';

const OrderSuccess = () => {
  const location = useLocation();
  const orderId = location.state?.orderId;

  return (
    <div className="order-success container">
      <div className="success-mark" aria-hidden="true">
        <Check size={28} strokeWidth={1.5} />
      </div>

      <p className="success-eyebrow">Confirmed</p>
      <h1 className="success-title">Thank you.</h1>
      <p className="success-subtitle">
        Your prints are being prepared with care. We&rsquo;ll be in touch soon.
      </p>

      {orderId && (
        <p className="success-id">
          <span>Order</span> #{orderId.slice(-8).toUpperCase()}
        </p>
      )}

      <hr className="success-rule" aria-hidden="true" />

      <div className="success-actions">
        <Link to="/my-orders" className="success-link">
          <span>View my orders</span> <ArrowRight size={14} />
        </Link>
        <Link to="/shop" className="success-link">
          <span>Keep browsing</span> <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccess;
