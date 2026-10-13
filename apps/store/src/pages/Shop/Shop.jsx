import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Frame, Search, SearchX, SlidersHorizontal, WifiOff, X } from 'lucide-react';
import api from '../../services/api';
import ProductCard from '../../components/ProductCard/ProductCard';
import PriceRangeSlider from '../../components/PriceRangeSlider/PriceRangeSlider';
import {
  EmptyState,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Spinner,
} from '@printlabs/ui';
import './Shop.css';

const SORT_OPTIONS = [
  { value: 'price_asc',  label: 'Price · Low → High' },
  { value: 'price_desc', label: 'Price · High → Low' },
  { value: 'newest',     label: 'Newest first' },
];

const Shop = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading`: a refetch caused by typing or changing a
  // filter, where results are already on screen. Wiping a full grid back
  // to skeletons on every keystroke loses the results the shopper is
  // reading mid-scan, so a refetch dims the grid instead of replacing it.
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allCategories, setAllCategories] = useState(['All']);
  const [allSizes, setAllSizes] = useState([]);
  const [priceBounds, setPriceBounds] = useState({ min: 0, max: 0 });
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile only
  // A failed fetch used to leave the grid looking simply empty, which
  // reads as "there are no posters" rather than "this did not load".
  const [fetchFailed, setFetchFailed] = useState(false);
  const hasResultsRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [minPriceInput, setMinPriceInput] = useState(searchParams.get('minPrice') || '');
  const [maxPriceInput, setMaxPriceInput] = useState(searchParams.get('maxPrice') || '');

  const activeCategory = searchParams.get('category') || 'All';
  const activeSize     = searchParams.get('size')     || '';
  const activeSort     = searchParams.get('sort')     || 'price_asc';

  // Mount-only: fetch the filter facets. This used to download the whole
  // catalogue (`?limit=1000`) and reduce it in the browser; the server now
  // computes categories, sizes and price bounds in a single aggregation
  // and returns a few hundred bytes.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const { data } = await api.get('/products/facets', { signal: controller.signal });
        const facets = data?.data || {};

        setAllCategories(['All', ...(facets.categories || [])]);
        setAllSizes(facets.sizes || []);
        setPriceBounds(facets.priceBounds || { min: 0, max: 0 });
      } catch (error) {
        if (error.name !== 'CanceledError') {
          console.debug('Could not load filter facets:', error?.message);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  // Build the query string from the URL params (the source of truth for
  // every applied filter) plus the live searchTerm / price inputs.
  const queryString = useMemo(() => {
    const parts = [];
    if (activeCategory !== 'All') parts.push(`category=${encodeURIComponent(activeCategory)}`);
    if (searchTerm)               parts.push(`search=${encodeURIComponent(searchTerm)}`);
    if (activeSize)               parts.push(`size=${encodeURIComponent(activeSize)}`);
    if (minPriceInput)            parts.push(`minPrice=${encodeURIComponent(minPriceInput)}`);
    if (maxPriceInput)            parts.push(`maxPrice=${encodeURIComponent(maxPriceInput)}`);
    if (activeSort)               parts.push(`sort=${encodeURIComponent(activeSort)}`);
    return parts.join('&');
  }, [activeCategory, searchTerm, activeSize, minPriceInput, maxPriceInput, activeSort]);

  useEffect(() => {
    const fetchProducts = async () => {
      // Skeletons only when there is nothing to preserve. Read through a
      // ref rather than the state value so this effect does not have to
      // depend on `products` and re-run itself on every result.
      if (hasResultsRef.current) setRefreshing(true);
      else setLoading(true);

      try {
        // A page size of 24 rather than the API's default of 12: the grid
        // shows three or four across, so 12 left an obviously short page.
        const { data } = await api.get(`/products?${queryString}&limit=24`);
        const nextProducts = data?.data?.products || data?.products || [];
        setFetchFailed(false);
        hasResultsRef.current = nextProducts.length > 0;
        setProducts(nextProducts);
        setPagination(data?.data?.pagination || null);
      } catch (error) {
        console.error('Error fetching products', error);
        setFetchFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [queryString]);

  // Each filter mutation merges into the existing URL params so other
  // filters and the search term are preserved across clicks.
  const mergeParam = (key, value) => {
    const next = Object.fromEntries(searchParams.entries());
    if (value === '' || value == null) delete next[key];
    else                                next[key] = String(value);
    setSearchParams(next);
  };

  const handleCategoryChange = (cat) => mergeParam('category', cat === 'All' ? '' : cat);
  const handleSizeChange     = (sz)  => mergeParam('size',     activeSize === sz ? '' : sz);
  const handleSortChange     = (s)   => mergeParam('sort',     s);

  const applyPriceBounds = () => {
    mergeParam('minPrice', minPriceInput || '');
    mergeParam('maxPrice', maxPriceInput || '');
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchParams({});
  };

  // The catalogue is paginated server-side, so the grid only ever held
  // the first page. Appending keeps the browsing flow uninterrupted.
  const loadMore = async () => {
    if (!pagination?.hasNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/products?${queryString}&limit=24&page=${pagination.page + 1}`);
      setProducts((prev) => [...prev, ...(data?.data?.products || [])]);
      setPagination(data?.data?.pagination || null);
    } catch (error) {
      console.debug('Could not load more products:', error?.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasActiveFilters =
    activeCategory !== 'All' || activeSize || minPriceInput || maxPriceInput || searchTerm;

  return (
    <div className="shop-page container">


      <div className="shop-body">
        <aside className={`shop-sidebar ${filtersOpen ? 'is-open' : ''}`}>
          {/* Mobile-only toggle. Hidden on desktop via CSS; replaces
              the 'Refine' eyebrow on small screens so users land on
              products first and pull filters down when needed. */}
          <button
            type="button"
            className="shop-filter-toggle"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="shop-filter-panel"
          >
            {filtersOpen ? <X size={14} aria-hidden="true" /> : <SlidersHorizontal size={14} aria-hidden="true" />}
            <span>{filtersOpen ? 'Hide filters' : 'Filters'}</span>
            {hasActiveFilters && !filtersOpen && (
              <span className="shop-filter-toggle-dot" aria-label="active filters" />
            )}
          </button>

          <div id="shop-filter-panel" className="shop-filter-panel">
          <div className="shop-filter-group">
            <p className="shop-sidebar-label">Category</p>
            <ul className="shop-category-list">
              {allCategories.map(cat => (
                <li key={cat}>
                  <button
                    className={activeCategory === cat ? 'is-active' : ''}
                    onClick={() => handleCategoryChange(cat)}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {allSizes.length > 0 && (
            <div className="shop-filter-group">
              <p className="shop-sidebar-label">Paper Size</p>
              <ul className="shop-chip-list">
                {allSizes.map(sz => (
                  <li key={sz}>
                    <button
                      className={`shop-chip ${activeSize === sz ? 'is-active' : ''}`}
                      onClick={() => handleSizeChange(sz)}
                    >
                      {sz}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {priceBounds.max > 0 && (
            <div className="shop-filter-group">
              <p className="shop-sidebar-label">Price</p>
              <PriceRangeSlider
                bounds={priceBounds}
                minValue={minPriceInput}
                maxValue={maxPriceInput}
                onMinChange={setMinPriceInput}
                onMaxChange={setMaxPriceInput}
                onCommit={applyPriceBounds}
              />
            </div>
          )}

          <div className="shop-filter-group">
            <p className="shop-sidebar-label">Sort By</p>
            {/* A native <select> was the one control in the storefront the
                app could not style: its option list is drawn by the OS,
                which is why the dark theme needed colour-scheme patches to
                stop it flashing white. This renders a real panel on the
                paper ground and stays fully keyboard-operable. */}
            <Select value={activeSort} onValueChange={handleSortChange}>
              <SelectTrigger className="shop-sort" aria-label="Sort products">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <button className="shop-clear-filters" onClick={clearAllFilters}>
              Clear all filters
            </button>
          )}
          </div>
        </aside>

        <main className="shop-main">
          <div className="shop-search">
            <Search size={16} className="shop-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by title…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search posters by title"
              aria-describedby="shop-result-count"
            />

            {/* Getting back out of a search took selecting the text and
                deleting it. One control does it, and it only exists when
                there is something to clear. */}
            {searchTerm && (
              <button
                type="button"
                className="shop-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}

            {/* Refetches are debounced by 300ms, so without this the page
                looks inert for a third of a second after each keystroke. */}
            {refreshing && <Spinner className="shop-search-status" label="Updating results" size={14} />}
          </div>

          {/* How much is being looked at, and out of how much. A grid on
              its own never says whether it is showing everything. */}
          <p
            id="shop-result-count"
            className="shop-result-count"
            role="status"
            aria-live="polite"
          >
            {loading
              ? 'Loading posters…'
              : pagination?.total
                ? `Showing ${products.length} of ${pagination.total} ${pagination.total === 1 ? 'poster' : 'posters'}`
                : products.length > 0
                  ? `${products.length} ${products.length === 1 ? 'poster' : 'posters'}`
                  : ''}
          </p>

          {loading ? (
            <div className="product-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card"></div>
              ))}
            </div>
          ) : fetchFailed ? (
            /* A request that failed is not an empty catalogue, and saying
               so is the difference between "come back later" and "try
               again". The retry re-runs the current query as it stands. */
            <EmptyState
              icon={WifiOff}
              title="Could not load the collection"
              description="The catalogue did not respond. Your filters are still applied — try again in a moment."
              action={() => setSearchParams(Object.fromEntries(searchParams.entries()))}
              actionLabel="Try again"
            />
          ) : products.length === 0 ? (
            hasActiveFilters ? (
              /* Filtered to nothing. The previous copy told the shopper to
                 clear the search but made them go and find the control;
                 the way out is offered here instead. */
              <EmptyState
                icon={SearchX}
                title="No posters match these filters"
                description={
                  searchTerm
                    ? `Nothing matched “${searchTerm}”. Try a shorter title, a different category, or a wider price range.`
                    : 'Try a different category, paper size, or a wider price range.'
                }
                action={clearAllFilters}
                actionLabel="Clear all filters"
              />
            ) : (
              <EmptyState
                icon={Frame}
                title="No posters on the wall"
                description="New work is being framed. Check back soon, or read the newsletter for first word on a drop."
              />
            )
          ) : (
            <>
              <div
                className={`product-grid ${refreshing ? 'is-refreshing' : ''}`}
                aria-busy={refreshing || undefined}
              >
                {products.map(product => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>

              {pagination?.hasNext && (
                <button
                  type="button"
                  className="shop-load-more"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Loading…'
                    : `Load more (${pagination.total - products.length} more)`}
                </button>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Shop;
