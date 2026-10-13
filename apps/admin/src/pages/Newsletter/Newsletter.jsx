import { useEffect, useState } from 'react';
import { Plus, Trash2, Mail } from 'lucide-react';
import api from '../../services/adminApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import log from '../../utils/logger';
import './Newsletter.css';

const Newsletter = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/admin/newsletter');
      setItems(data?.data?.items || []);
    } catch (error) {
      log.error('Newsletter list failed', { error: error?.message });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(() => { fetchItems(); }, []);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    log.action('Publish newsletter', { titleLen: title.length, bodyLen: body.length });
    try {
      await api.post('/admin/newsletter', {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim()
      });
      setTitle('');
      setBody('');
      setImageUrl('');
      setFeedback({ kind: 'ok', text: 'Published.' });
      fetchItems();
    } catch (error) {
      log.error('Newsletter publish failed', { error: error?.response?.data?.message });
      setFeedback({ kind: 'err', text: error?.response?.data?.message || 'Could not publish.' });
    } finally {
      setPosting(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    log.action('Delete newsletter entry', { id: deleteTarget._id });
    try {
      await api.delete(`/admin/newsletter/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchItems();
    } catch (error) {
      log.error('Newsletter delete failed', { id: deleteTarget._id, error: error?.response?.data?.message });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="newsletter-page">
      <div className="page-header">
        <h1>Newsletter</h1>
      </div>

      <section className="newsletter-composer">
        <h2 className="newsletter-composer-title">Publish a new drop</h2>
        <form onSubmit={handlePublish}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Bauhaus drop, June 2026"
              maxLength={140}
              required
            />
          </div>
          <div className="form-group">
            <label>Image URL (Optional)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="e.g. https://images.unsplash.com/... or a Cloudinary URL"
            />
          </div>
          <div className="form-group">
            <label>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What landed in the shop. Why it matters. Anything else."
              rows={6}
              maxLength={4000}
              required
            />
          </div>
          <div className="newsletter-composer-row">
            <span className="newsletter-composer-count">{body.length} / 4000</span>
            <button type="submit" className="btn-primary" disabled={posting || !title.trim() || !body.trim()}>
              <Plus size={14} />
              <span>{posting ? 'Publishing…' : 'Publish'}</span>
            </button>
          </div>
          {feedback && (
            <p className={`newsletter-feedback ${feedback.kind}`}>{feedback.text}</p>
          )}
        </form>
      </section>

      <section className="newsletter-list-section">
        <h2 className="newsletter-list-title">Published</h2>
        {loading ? (
          <div className="loading-screen">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Mail size={48} />
            <h3>No newsletters yet</h3>
            <p>The customer Newsletter page will be empty until you publish a drop.</p>
          </div>
        ) : (
          <ul className="newsletter-list">
            {items.map((item) => (
              <li key={item._id} className="newsletter-item">
                <div className="newsletter-item-meta">
                  <span className="newsletter-item-date">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="btn-sm btn-delete"
                    onClick={() => setDeleteTarget(item)}
                    title="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3 className="newsletter-item-heading">{item.title}</h3>
                <p className="newsletter-item-body">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Newsletter Entry"
          message={`Delete "${deleteTarget.title}"? This removes it from the public Newsletter page.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Newsletter;
