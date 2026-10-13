import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LifeBuoy, ExternalLink } from 'lucide-react';
import { degrade } from '../../utils/imageQuality';

const MiniProductCard = ({ product, onSelect }) => {
  const productId = product._id || product.productId || product.id;
  const imageUrl = product.images?.[0]?.url || product.imageUrl || product.image || '';
  const optimizedUrl = degrade(imageUrl, 'card');

  return (
    <div className="fabi-mini-card" onClick={() => onSelect(productId)}>
      <div className="fabi-mini-card-img">
        {optimizedUrl ? (
          <img src={optimizedUrl} alt={product.title} loading="lazy" />
        ) : (
          <div className="fabi-mini-placeholder">POSTER</div>
        )}
      </div>
      <div className="fabi-mini-card-details">
        <h5 className="fabi-mini-card-title">{product.title}</h5>
        <div className="fabi-mini-card-footer">
          <span className="fabi-mini-card-price">₹{product.price}</span>
          <span className="fabi-mini-card-action">
            VIEW <ArrowRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
};

const FabiMessages = ({ messages, isTyping, onCloseChat, onSelectSuggestion }) => {
  const listRef = useRef(null);
  const navigate = useNavigate();

  /**
   * Keep the newest message in view.
   *
   * Replies used to arrive below the fold — sending a message looked
   * like nothing had happened. The cause was `behavior: 'smooth'`, not
   * the element being scrolled: measured side by side on this panel,
   * `scrollTop = scrollHeight` and `scrollTo({behavior:'auto'})` both
   * land at 228, while `scrollTo({behavior:'smooth'})` leaves it at 0.
   * Smoothness is a nicety; arriving is the requirement.
   *
   * Product cards carry images that load after this runs and grow the
   * content further, so the position is reasserted as they arrive.
   */
  useEffect(() => {
    const scroller = listRef.current?.closest('.fabi-body');
    if (!scroller) return;

    const pin = () => { scroller.scrollTop = scroller.scrollHeight; };

    // Pin immediately: by the time an effect runs React has committed the
    // DOM, so scrollHeight already includes the new message.
    pin();

    // Then again after a frame, to catch any layout that settles late.
    // rAF alone is not enough — it does not fire while the tab is hidden,
    // which would leave a backgrounded conversation stuck at the top the
    // moment it is brought forward. The timeout is the guarantee.
    const frame = requestAnimationFrame(pin);
    const timer = setTimeout(pin, 60);

    // Product cards carry images that load later and grow the content.
    const images = listRef.current.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.complete) img.addEventListener('load', pin, { once: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      images.forEach((img) => img.removeEventListener('load', pin));
    };
  }, [messages, isTyping]);

  const lastId = messages[messages.length - 1]?.id;
  const isLast = (msg) => msg.id === lastId;

  const handleProductClick = (productId) => {
    if (productId) {
      navigate(`/product/${productId}`);
      if (window.innerWidth < 600) {
        onCloseChat();
      }
    }
  };

  return (
    <div className="fabi-messages-container" ref={listRef}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`fabi-message-wrapper ${
            msg.sender === 'user' ? 'is-user' : 'is-bot'
          }`}
        >
          <div className="fabi-message-bubble">
            <p className="fabi-message-text">{msg.text}</p>

            {/* Scope note on the greeting. Quiet, inline, and gone as
                soon as the conversation moves on. */}
            {msg.note && <p className="fabi-message-note">{msg.note}</p>}

            {/* Payment Refusal Action Button */}
            {msg.isPaymentRefusal && msg.action && (
              <div className="fabi-refusal-action">
                <a
                  href={msg.action.href}
                  className="fabi-refusal-btn"
                  target="_blank"
                  rel="noreferrer"
                >
                  <LifeBuoy size={14} />
                  <span>{msg.action.label}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* Embedded Product Recommendation Cards */}
            {msg.products && msg.products.length > 0 && (
              <div className="fabi-product-grid">
                {msg.products.map((prod, idx) => (
                  <MiniProductCard
                    key={prod._id || prod.productId || prod.id || idx}
                    product={prod}
                    onSelect={handleProductClick}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="fabi-message-time">{msg.timestamp}</span>

          {/* Follow-ups, on the newest reply only. Older ones would be
              answering a question the conversation has already moved past,
              and a column of stale chip rows is exactly the clutter the
              fixed opener list used to create. */}
          {isLast(msg) && msg.suggestions?.length > 0 && !isTyping && (
            <div className="fabi-followups">
              {msg.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="fabi-chip-btn"
                  onClick={() => onSelectSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Typing Indicator */}
      {isTyping && (
        <div className="fabi-message-wrapper is-bot">
          <div className="fabi-message-bubble fabi-typing-bubble">
            <span className="fabi-typing-dot"></span>
            <span className="fabi-typing-dot"></span>
            <span className="fabi-typing-dot"></span>
          </div>
        </div>
      )}

    </div>
  );
};

export default FabiMessages;
