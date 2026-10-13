import { useEffect, useState } from 'react';
import api from '../../services/api';
import './Newsletter.css';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=800',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800'
];

const Newsletter = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/newsletter');
        if (!alive) return;
        setItems(data?.data?.items || []);
      } catch (err) {
        if (!alive) return;
        console.debug('Newsletter load failed:', err?.message);
        setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="newsletter-page">
      <header className="nl-page-header">
        <div className="nl-page-header-inner container">
          <span>Newsletter</span>
          <span className="nl-header-sep" aria-hidden="true">/</span>
          <span>The Print Labs</span>
        </div>
      </header>

      <div className="container">

      <section className="newsletter-feed">
        {loading ? (
          <p className="newsletter-empty">Loading…</p>
        ) : failed ? (
          <p className="newsletter-empty">Couldn’t reach the wall. Refresh in a moment.</p>
        ) : items.length === 0 ? (
          <p className="newsletter-empty">Nothing on the wall yet. Check back soon.</p>
        ) : (
          <ul className="newsletter-list">
            {items.map((item, index) => {
              const imgUrl = item.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
              const isEven = index % 2 === 0;
              return (
                <li key={item._id} className={`newsletter-item-card ${isEven ? 'layout-left' : 'layout-right'}`}>
                  <div className="newsletter-card-image">
                    <img src={imgUrl} alt={item.title} />
                  </div>
                  <div className="newsletter-card-content">
                    <p className="newsletter-card-date">{formatDate(item.createdAt)}</p>
                    <h2 className="newsletter-card-title">{item.title}</h2>
                    <p className="newsletter-card-body">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
};

export default Newsletter;
