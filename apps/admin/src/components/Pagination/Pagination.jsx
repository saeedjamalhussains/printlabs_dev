import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

/**
 * Page control for the admin list views.
 *
 * Every list endpoint is server-paginated, but no page ever asked for a
 * page beyond the first — so an admin silently saw only the newest 25
 * orders or users with nothing on screen to suggest more existed.
 *
 * Renders nothing when everything fits on one page.
 */
const Pagination = ({ pagination, onChange, busy = false, unit = 'items' }) => {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, pages, total, limit, hasPrev, hasNext } = pagination;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav className="admin-pagination" aria-label={`${unit} pagination`}>
      <p className="admin-pagination-count">
        {first}–{last} of {total} {unit}
      </p>

      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => onChange(page - 1)}
          disabled={!hasPrev || busy}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        <span className="admin-pagination-page">
          Page {page} of {pages}
        </span>

        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => onChange(page + 1)}
          disabled={!hasNext || busy}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
