import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Truck, RefreshCw, Plus, Minus } from 'lucide-react';
import api from '../../services/api';
import { useCart } from '../../hooks/useCart';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import PosterImage from '../../components/PosterImage/PosterImage';
import PosterCarousel from '../../components/PosterCarousel/PosterCarousel';
import './ProductDetail.css';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [aspectRatio, setAspectRatio] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const { addToCart, getCartItem } = useCart();
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data.data.product);
      } catch (error) {
        console.error('Error fetching product', error);
        navigate('/shop');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, navigate]);

  /* Suggestions are derived from the existing catalogue endpoint rather
     than a new "related products" API — this is a presentation feature
     and does not warrant a backend change. Posters from the same category
     first, topped up with the newest work if that category is thin, so
     the rail is never nearly empty. */
  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();

    (async () => {
      setSuggestionsLoading(true);
      try {
        const sameCategory = await api.get('/products', {
          params: { category: product.category, limit: 12 },
          signal: controller.signal,
        });

        let found = (sameCategory.data?.data?.products || []).filter(
          (p) => p._id !== product._id
        );

        if (found.length < 4) {
          const newest = await api.get('/products', {
            params: { sort: 'newest', limit: 12 },
            signal: controller.signal,
          });
          const seen = new Set([product._id, ...found.map((p) => p._id)]);
          found = [
            ...found,
            ...(newest.data?.data?.products || []).filter((p) => !seen.has(p._id)),
          ];
        }

        setSuggestions(found.slice(0, 12));
      } catch (error) {
        // A rail that cannot load is simply not shown. It is a secondary
        // aid, and an error panel under the poster would give it more
        // weight than it deserves.
        if (error.name !== 'CanceledError') {
          console.debug('Could not load suggestions:', error?.message);
          setSuggestions([]);
        }
      } finally {
        setSuggestionsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [product]);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      setAspectRatio(naturalWidth / naturalHeight);
    }
  };

  if (loading) return <div className="container detail-loading">Loading…</div>;
  if (!product) return null;

  // How much of this product is already in the basket, and therefore how
  // much more can still be added. Both the quantity stepper and the CTA
  // read from this, so the page can never offer more than exists.
  const inCartQty = getCartItem(product._id)?.quantity || 0;
  const addable = Math.max(0, product.stock - inCartQty);
  const outOfStock = product.stock <= 0;

  const ctaLabel = outOfStock
    ? 'Out of Stock'
    : inCartQty > 0
      ? `Go to Cart (${inCartQty})`
      : 'Add to Cart';

  const handleCartAction = () => {
    if (inCartQty > 0) {
      navigate('/cart');
      return;
    }
    if (!requireAuth('add items to your cart')) return;
    addToCart({ ...product, quantity: qty });
  };

  const handleAddMore = () => {
    if (!requireAuth('add items to your cart')) return;
    addToCart({ ...product, quantity: Math.min(qty, addable) });
  };

  return (
    <div className="product-detail container">
      <button className="detail-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> <span>Back</span>
      </button>

      <div className="detail-grid">
        {/* The main subject of the page: loaded eagerly and hinted high
            priority, because this is the image the Largest Contentful
            Paint is measured on. It is also the only image in the app
            allowed to reach the full stored 800px, and only on a wide
            screen — `sizes` caps it to the column it occupies. */}
        <PosterImage
          className="detail-image"
          url={product.images?.[0]?.url || product.imageUrl}
          variants={product.images?.[0]?.variants}
          alt={product.title}
          aspectRatio={aspectRatio ? `${aspectRatio}` : '3 / 4'}
          sizes="(max-width: 900px) 92vw, min(46vw, 700px)"
          maxWidth={700}
          priority
          onLoad={handleImageLoad}
        />

        <div className="detail-info">
          <p className="detail-category">{product.category}</p>
          <h1 className="detail-title">{product.title}</h1>
          <p className="detail-price">₹{product.price}</p>

          <hr className="detail-rule" aria-hidden="true" />

          <p className="detail-description">{product.description}</p>

          <div className="detail-purchase">
            <div className="detail-qty">
              <span className="detail-qty-label">Quantity</span>
              <div className="detail-qty-controls">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  aria-label="Decrease"
                  disabled={qty <= 1 || addable === 0}
                >
                  <Minus size={14} />
                </button>
                <span>{qty}</span>
                <button
                  onClick={() => setQty(Math.min(addable, qty + 1))}
                  aria-label="Increase"
                  // Capped by what is left after the cart, not by raw
                  // stock — otherwise the page offers a quantity that
                  // silently gets trimmed on add.
                  disabled={qty >= addable}
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="detail-stock">
                {inCartQty > 0
                  ? `${inCartQty} in cart · ${addable} more available`
                  : `${product.stock} left`}
              </span>
            </div>

            <button
              className="detail-cta"
              onClick={handleCartAction}
              disabled={outOfStock}
            >
              {ctaLabel}
            </button>

            {inCartQty > 0 && addable > 0 && (
              <button
                className="detail-cta-secondary"
                onClick={handleAddMore}
              >
                Add {Math.min(qty, addable)} more
              </button>
            )}
          </div>

          <hr className="detail-rule" aria-hidden="true" />

          <ul className="detail-features">
            <li><Truck size={16} /><span>Free Delivery</span></li>
            <li><ShieldCheck size={16} /><span>Secure Payment</span></li>
            <li><RefreshCw size={16} /><span>7-Day Return</span></li>
          </ul>
        </div>
      </div>

      {/* Last in the reading order, after the poster and everything
          needed to buy it — these are onward routes, not competition for
          the item above. Hidden entirely when there is nothing to show. */}
      {(suggestionsLoading || suggestions.length > 0) && (
        <section className="detail-suggestions" aria-labelledby="detail-suggestions-heading">
          <h2 id="detail-suggestions-heading" className="detail-suggestions-head">
            More Suggestions
          </h2>

          <PosterCarousel posters={suggestions} loading={suggestionsLoading} />
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
