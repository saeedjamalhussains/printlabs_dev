import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, HardDrive } from 'lucide-react';
import api from '../../services/adminApi';
import log from '../../utils/logger';
import './Audit.css';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const Audit = () => {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failedOnly, setFailedOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (actionFilter) params.action = actionFilter;

      const [logRes, statsRes] = await Promise.all([
        api.get('/admin/audit', { params }),
        api.get('/admin/audit/stats'),
      ]);
      setEntries(logRes.data.data.entries);
      setStats(statsRes.data.data);
    } catch (error) {
      log.error('Audit fetch failed', { error: error?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { fetchLog(); }, [fetchLog]);

  const visible = failedOnly ? entries.filter((e) => e.success === false) : entries;

  return (
    <div className="audit-page">
      <header className="audit-header">
        <div>
          <h1 className="audit-title">Audit Trail</h1>
          <p className="audit-sub">
            Append-only record of every state-changing request. Reads are not recorded.
          </p>
        </div>
        <button type="button" className="audit-refresh" onClick={fetchLog} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'audit-spin' : ''} /> Refresh
        </button>
      </header>

      {stats && (
        <div className="audit-stats">
          <div className="audit-stat">
            <HardDrive size={13} />
            <span>{formatBytes(stats.totalBytes)} on disk</span>
          </div>
          <div className="audit-stat">
            <span>{stats.archiveCount} archived {stats.archiveCount === 1 ? 'file' : 'files'}</span>
          </div>
          <div className="audit-stat">
            <span>capped at {formatBytes(stats.ceilingBytes)}</span>
          </div>
        </div>
      )}

      <div className="audit-controls">
        <input
          type="search"
          className="audit-filter"
          placeholder="Filter by action (e.g. admin.order.refund)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value.trim())}
        />
        <label className="audit-toggle">
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(e) => setFailedOnly(e.target.checked)}
          />
          <span>Failures only</span>
        </label>
      </div>

      {loading && entries.length === 0 ? (
        <p className="audit-empty">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="audit-empty">No entries match.</p>
      ) : (
        <ul className="audit-list">
          {visible.map((entry) => (
            <li
              key={`${entry.requestId}-${entry.timestamp}`}
              className={`audit-entry ${entry.success === false ? 'failed' : ''}`}
            >
              <div className="audit-entry-head">
                <span className="audit-action">{entry.action}</span>
                <span className={`audit-status s-${Math.floor((entry.status || 0) / 100)}`}>
                  {entry.status}
                </span>
                <time className="audit-time">
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              </div>

              <div className="audit-entry-meta">
                <span>{entry.actorEmail || entry.actorId || 'anonymous'}</span>
                <span>{entry.ip}</span>
                <span>{entry.durationMs}ms</span>
                {entry.targetId && <span className="audit-target">{entry.targetId}</span>}
              </div>

              {entry.error && (
                <div className="audit-error">
                  <ShieldAlert size={12} /> {entry.error}
                </div>
              )}

              {entry.changes && Object.keys(entry.changes).length > 0 && (
                <pre className="audit-changes">{JSON.stringify(entry.changes, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Audit;
