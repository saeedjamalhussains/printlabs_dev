import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../../services/api';
import ProductCard from '../../components/ProductCard/ProductCard';
import { getQuoteOfTheDay } from '../../utils/quotes';
import './Home.css';

const formatTodayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const quote = getQuoteOfTheDay();
  const today = formatTodayLabel();

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    (async () => {
      try {
        const { data } = await api.get('/products?limit=8', { signal: controller.signal });
        if (!alive) return;
        const nextProducts = data?.data?.products || data?.products || [];
        setProducts(nextProducts);
        setFailed(false);
      } catch (err) {
        // Quietly skip if the request was cancelled or aborted.
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
        if (!alive) return;
        // Log a single debug line since the network panel already surfaces details.
        console.debug('Featured posters unavailable:', err?.message);
        setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="home-page">
      <section className="hero container">
        <div className="hero-inner">
          <p className="hero-eyebrow">
            <span>Today&rsquo;s Reflection</span>
            <span className="hero-eyebrow-sep" aria-hidden="true">/</span>
            <span>{today}</span>
          </p>

          <blockquote className="hero-quote">{quote.text}</blockquote>
          <cite className="hero-quote-author">&mdash; {quote.author}</cite>

          <Link to="/shop" className="hero-cta">
            <span>Explore the collection</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="featured container">
        <div className="featured-box">
          <header className="featured-header">
            <div className="featured-meta">
              <h2 className="featured-title">Featured Posters</h2>
              <p className="featured-subtitle">Hand picked pieces, ready to be hung.</p>
            </div>
          </header>

          <div className="featured-body">
            {loading ? (
              <div className="product-grid">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton-card" />
                ))}
              </div>
            ) : failed ? (
              <p className="featured-empty">
                Couldn&rsquo;t reach the gallery. Refresh in a moment.
              </p>
            ) : products.length === 0 ? (
              <p className="featured-empty">The wall is empty. New work coming soon.</p>
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} showView={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="closing container">
        <p className="closing-eyebrow">For the walls that tell stories</p>
        <h3 className="closing-title">
          Print, frame, <em>live with it.</em>
        </h3>
      </section>
    </div>
  );
};

export default Home;
