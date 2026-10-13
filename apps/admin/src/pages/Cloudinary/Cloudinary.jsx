import { useState, useEffect } from 'react';
import { Trash2, RefreshCw, ImageOff } from 'lucide-react';
import api from '../../services/adminApi';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import log from '../../utils/logger';
import './Cloudinary.css';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

const Cloudinary = () => {

  const [resources, setResources] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // `showLoading` is false for the mount fetch only: `loading` already
  // starts true, so setting it again would be a redundant setState run
  // synchronously inside the effect — which triggers a cascading render.
  const fetchResources = async (cursor = null, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const { data } = await api.get('/admin/cloudinary', {
        params: cursor ? { next_cursor: cursor } : {},
      });
      if (cursor) {
        setResources((prev) => [...prev, ...data.data.resources]);
      } else {
        setResources(data.data.resources);
      }
      setNextCursor(data.data.nextCursor);
    } catch (error) {
      console.error('Cloudinary list failed:', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const { data } = await api.get('/admin/cloudinary/usage');
      setUsage(data.data);
    } catch (error) {
      console.error('Cloudinary usage failed:', error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    // Mount-time data fetch. The rule guards against setState causing a
    // cascading render; here every setState lands after an await, so the
    // render it schedules is the one that shows the fetched data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchResources(null, false);
    fetchUsage();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    log.action('Cloudinary delete confirmed', { publicId: deleteTarget });
    setDeleting(true);
    try {
      await api.delete(`/admin/cloudinary/${encodeURIComponent(deleteTarget)}`);
      log.action('Cloudinary resource deleted', { publicId: deleteTarget });
      setResources((prev) => prev.filter((r) => r.publicId !== deleteTarget));
      setDeleteTarget(null);
      fetchUsage();
    } catch (error) {
      log.error('Cloudinary delete failed', { publicId: deleteTarget, error: error?.response?.data?.message });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && resources.length === 0) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="cloudinary-page">
      <div className="page-header">
        <h1>Cloudinary</h1>
        <button className="btn-outline" onClick={() => { fetchResources(); fetchUsage(); }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {usage && !usage.unavailable && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Storage Remaining</span>
            </div>
            <div className="stat-value">
              {usage.storage?.limit && usage.storage?.usage
                ? formatBytes(usage.storage.limit - usage.storage.usage)
                : '—'}
            </div>
            <div className="stat-change">of {formatBytes(usage.storage?.limit)} total</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Bandwidth</span>
            </div>
            <div className="stat-value">{formatBytes(usage.bandwidth?.usage)}</div>
            <div className="stat-change">of {formatBytes(usage.bandwidth?.limit)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Resources</span>
            </div>
            <div className="stat-value">{usage.resources ?? '—'}</div>
            <div className="stat-change">{usage.derivedResources ?? 0} derived</div>
          </div>
        </div>
      )}

      {usage?.unavailable && (
        <div className="empty-state" style={{ padding: '1.5rem', textAlign: 'left', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Usage stats unavailable on this Cloudinary plan/key.
          </p>
        </div>
      )}

      {resources.length === 0 ? (
        <div className="empty-state">
          <ImageOff size={48} />
          <h3>No Resources</h3>
          <p>No Cloudinary uploads under this prefix.</p>
        </div>
      ) : (
        <>
          <div className="cloudinary-grid">
            {resources.map((r) => (
              <div key={r.publicId} className="cloudinary-card">
                <div className="cloudinary-thumb">
                  <img
                    src={r.url.replace('/upload/', '/upload/w_300,q_auto/')}
                    alt={r.publicId}
                  />
                </div>
                <div className="cloudinary-meta">
                  <div className="cloudinary-id" title={r.publicId}>{r.publicId}</div>
                  <div className="cloudinary-stats">
                    <span>{r.format?.toUpperCase()}</span>
                    <span>{r.width}×{r.height}</span>
                    <span>{formatBytes(r.bytes)}</span>
                  </div>
                  <div className="cloudinary-actions">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-outline btn-sm"
                    >
                      View
                    </a>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => setDeleteTarget(r.publicId)}
                      disabled={deleting}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                className="btn-outline"
                onClick={() => fetchResources(nextCursor)}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Cloudinary Resource"
          message={`Permanently remove "${deleteTarget}" from Cloudinary? This cannot be undone, and any product/order still referencing it will show a broken/missing image.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Cloudinary;
