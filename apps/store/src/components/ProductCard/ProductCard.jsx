import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../../hooks/useCart';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useMasonrySpan } from '../../hooks/useMasonrySpan';
import PosterImage from '../PosterImage/PosterImage';
import { toast } from '@printlabs/ui';
import './ProductCard.css';

const ProductCard = ({ product, showView = false }) => {
  const { addToCart, getCartItem } = useCart();
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();
  const [aspectRatio, setAspectRatio] = useState(null);
  const { ref: cardRef, recalculate } = useMasonrySpan();

  // Once a product is in the cart, offering "Add to Cart" again is both a
  // dead end and a lie — a second click silently bumped the quantity with
  // no visible change. The button becomes the next useful action instead.
  const cartItem = getCartItem(product._id);
  const inCart = Boolean(cartItem);
  const outOfStock = product.stock <= 0;
  const atStockLimit = inCart && cartItem.quantity >= product.stock;

  const handleCartAction = (e) => {
    // The whole card is a <Link> to the product page.
    e.preventDefault();
    e.stopPropagation();
    if (inCart) {
      navigate('/cart');
      return;
    }
    // Browsing is open to everyone; putting something in a basket is not.
    if (!requireAuth('add items to your cart')) return;
    addToCart(product);

    // The button relabelling itself to "Go to cart" is the durable signal,
    // but it is a small change in one card on a long grid and is easy to
    // miss — especially when the click lands below the fold of a tall
    // masonry column. The toast confirms what went in, and carries the
    // next step rather than making it a hunt for the cart icon.
    toast.success('Added to cart', {
      description: product.title,
      action: { label: 'View cart', onClick: () => navigate('/cart') },
    });
  };

  const label = outOfStock
    ? 'OUT OF STOCK'
    : inCart
      ? `GO TO CART (${cartItem.quantity})`
      : 'ADD TO CART';

  const imageUrl = product.images?.[0]?.url || product.imageUrl || '';

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setAspectRatio(naturalWidth / naturalHeight);
      // The card's height only becomes real once the image has one, so
      // the row span is measured again rather than left at the 3/4
      // placeholder's value.
      requestAnimationFrame(recalculate);
    }
  };

  return (
    <Link ref={cardRef} to={`/product/${product._id}`} className="product-card">
      {/* `sizes` has to describe the width this card is *actually* laid
          out at, because the browser uses it to choose a rung before any
          layout exists. Overstating it is not harmless: a first attempt
          claimed 300px here, the browser doubled it for this screen and
          concluded it needed 600px, and every card fell back to the full
          stored file.

          The grid is auto-fill/minmax(180px, 1fr), which means extra
          width becomes more columns rather than wider cards — so beyond
          the phone breakpoints the card stays near 200px whatever the
          monitor, and a fixed value describes it better than a vw. */}
      <PosterImage
        className="card-image"
        url={imageUrl}
        variants={product.images?.[0]?.variants}
        alt={product.title}
        aspectRatio={aspectRatio ? `${aspectRatio}` : '3 / 4'}
        sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 200px"
        maxWidth={220}
        onLoad={handleImageLoad}
      />
      <div className="card-info">
        <h3>{product.title}</h3>
        <div className="card-footer">
          {showView ? (
            <span className="view-btn" style={{ marginLeft: 'auto' }}>
              <span>VIEW</span> <ArrowRight size={12} />
            </span>
          ) : (
            <>
              <span className="price">₹{product.price}</span>
              <button
                className={`add-to-cart-btn${inCart ? ' is-in-cart' : ''}`}
                onClick={handleCartAction}
                disabled={outOfStock}
                title={atStockLimit ? 'All available stock is in your cart' : undefined}
              >
                {label}
              </button>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
