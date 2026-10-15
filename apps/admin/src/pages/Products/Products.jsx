import { useCallback, useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Package, PackagePlus, Power } from 'lucide-react';
import api from '../../services/adminApi';
import Modal from '../../components/Modal/Modal';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import RestockModal from './RestockModal';
import Pagination from '../../components/Pagination/Pagination';
import log from '../../utils/logger';
import { splitCategories } from '@printlabs/categories';
import './Products.css';

// At or below this many units the row is flagged, so a restock happens
// before the product sells out rather than after.
const LOW_STOCK = 5;

const emptyProduct = {
  title: '',
  description: '',
  price: '',
  category: '',
  stock: '',
  sizes: '',
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imageDeleteTarget, setImageDeleteTarget] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [restockTarget, setRestockTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const notify = (kind, text) => {
    setFeedback({ kind, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchProducts = useCallback(async (targetPage) => {
    try {
      // includeInactive is admin-only and returns deactivated products
      // too, which the dashboard needs in order to manage them.
      const { data } = await api.get('/products', {
        params: { limit: 50, includeInactive: true, page: targetPage },
      });
      setProducts(data.data.products);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Products fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { fetchProducts(page); }, [fetchProducts, page]);

  const openCreate = () => {
    log.action('Open create-product modal');
    setEditingProduct(null);
    setFormData(emptyProduct);
    setImageFile(null);
    setShowModal(true);
  };

  const openEdit = async (product) => {
    log.action('Open edit-product modal', { id: product._id, title: product.title });
    setEditingProduct(product);
    setImageFile(null);
    setShowModal(true);

    // The list response omits `description` to keep the payload small, so
    // the full document is fetched before populating the form — otherwise
    // editing a product would silently blank its description.
    let full = product;
    try {
      const { data } = await api.get(`/products/${product._id}`);
      full = data.data.product;
    } catch (error) {
      log.error('Could not load full product', { id: product._id, error: error?.response?.data?.message });
    }

    setFormData({
      title: full.title ?? '',
      description: full.description ?? '',
      price: full.price ?? '',
      category: full.category ?? '',
      stock: full.stock ?? '',
      sizes: full.sizes?.map((s) => s.label).join(', ') || '',
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const uploadImage = async (productId, file) => {
    log.action('Upload image → product', { productId, fileName: file.name, sizeKB: Math.round(file.size / 1024) });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/products/${productId}/images`, fd);
      log.action('Image uploaded', { productId });
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      log.error('Image upload failed', { productId, msg });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        // Keep any price modifier already stored against a size label;
        // the text field only edits the labels themselves.
        sizes: formData.sizes
          ? formData.sizes
              .split(',')
              .map((label) => label.trim())
              .filter(Boolean)
              .map((label) => ({
                label,
                priceModifier:
                  editingProduct?.sizes?.find((s) => s.label === label)?.priceModifier ?? 0,
              }))
          : [],
      };

      if (editingProduct) {
        log.action('Update product', { id: editingProduct._id });
        await api.put(`/products/${editingProduct._id}`, payload);
        if (imageFile) await uploadImage(editingProduct._id, imageFile);
        log.action('Product updated', { id: editingProduct._id });
      } else {
        log.action('Create product', { title: payload.title });
        const { data } = await api.post('/products', payload);
        log.action('Product created', { id: data.data.product._id });
        if (imageFile) await uploadImage(data.data.product._id, imageFile);
      }

      setShowModal(false);
      setImageFile(null);
      fetchProducts(page);
    } catch (error) {
      log.error('Product save failed', { error: error?.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    log.action('Delete product confirmed', { id: deleteTarget });
    try {
      await api.delete(`/products/${deleteTarget}`);
      log.action('Product deleted', { id: deleteTarget });
      setDeleteTarget(null);
      fetchProducts(page);
    } catch (error) {
      log.error('Product delete failed', { id: deleteTarget, error: error?.response?.data?.message });
      setDeleteTarget(null);
    }
  };

  /**
   * Bring a discontinued product back, or retire a live one.
   *
   * `isActive` was rendered in the table but nothing could change it, so a
   * discontinued product was stranded: the storefront hid it and the only
   * other action available was a permanent delete.
   */
  const handleToggleActive = async (product) => {
    const reactivating = !product.isActive;
    log.action(reactivating ? 'Reactivate product' : 'Discontinue product', { id: product._id });
    setBusyId(product._id);
    try {
      const { data } = await api.put(`/products/${product._id}`, { isActive: reactivating });
      const updated = data.data.product;
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, ...updated } : p)));
      notify('ok', `"${product.title}" is now ${reactivating ? 'active' : 'discontinued'}.`);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Could not update this product.';
      log.error('Toggle active failed', { id: product._id, error: msg });
      notify('err', msg);
    } finally {
      setBusyId(null);
    }
  };

  /** Write a new stock level, computed by the restock dialog. */
  const handleRestock = async (newStock) => {
    if (!restockTarget) return;
    log.action('Restock product', { id: restockTarget._id, from: restockTarget.stock, to: newStock });
    setBusyId(restockTarget._id);
    try {
      const { data } = await api.put(`/products/${restockTarget._id}`, { stock: newStock });
      const updated = data.data.product;
      setProducts((prev) => prev.map((p) => (p._id === restockTarget._id ? { ...p, ...updated } : p)));
      notify('ok', `"${restockTarget.title}" restocked to ${newStock}.`);
      setRestockTarget(null);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Could not update the stock level.';
      log.error('Restock failed', { id: restockTarget._id, error: msg });
      notify('err', msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleImageRemove = async () => {
    if (!imageDeleteTarget) return;
    log.action('Delete product image', imageDeleteTarget);
    try {
      await api.delete(`/products/${imageDeleteTarget.productId}/images/${encodeURIComponent(imageDeleteTarget.publicId)}`);
      log.action('Image removed', imageDeleteTarget);
      setImageDeleteTarget(null);
      fetchProducts(page);
    } catch (error) {
      log.error('Image delete failed', { ...imageDeleteTarget, error: error?.response?.data?.message });
      setImageDeleteTarget(null);
    }
  };

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="products-page">
      <div className="page-header">
        <h1>Products</h1>
      </div>

      {feedback && (
        <div className={`products-feedback products-feedback-${feedback.kind}`}>{feedback.text}</div>
      )}

      <div className="products-toolbar">
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <Package size={48} />
          <h3>No Products</h3>
          <p>Create your first product to get started.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td>
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url.replace('/upload/', '/upload/w_60,q_auto/')}
                        alt={product.title}
                        style={{ width: 48, height: 48, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 48, height: 48, background: 'var(--border-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', color: 'var(--text-muted)'
                      }}>
                        No img
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{product.title}</td>
                  <td>{product.category}</td>
                  <td>₹{product.price}</td>
                  <td>
                    <span className={`stock-level ${
                      product.stock === 0 ? 'is-out' : product.stock <= LOW_STOCK ? 'is-low' : ''
                    }`}>
                      {product.stock}
                    </span>
                    {product.stock === 0 && <span className="stock-note">Out of stock</span>}
                    {product.stock > 0 && product.stock <= LOW_STOCK && (
                      <span className="stock-note">Running low</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${product.isActive ? 'badge-active' : 'badge-inactive'}`}>
                      {product.isActive ? 'Active' : 'Discontinued'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => openEdit(product)}
                        title="Edit product"
                        aria-label={`Edit ${product.title}`}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        className="btn-outline btn-sm"
                        onClick={() => setRestockTarget(product)}
                        disabled={busyId === product._id}
                        title="Restock"
                        aria-label={`Restock ${product.title}`}
                      >
                        <PackagePlus size={14} />
                      </button>

                      <button
                        className={`btn-outline btn-sm ${product.isActive ? 'is-on' : 'is-off'}`}
                        onClick={() => handleToggleActive(product)}
                        disabled={busyId === product._id}
                        title={product.isActive ? 'Discontinue product' : 'Reactivate product'}
                        aria-label={
                          product.isActive
                            ? `Discontinue ${product.title}`
                            : `Reactivate ${product.title}`
                        }
                      >
                        <Power size={14} />
                      </button>

                      {/* Shown for discontinued products too — otherwise a
                          retired product could never be cleared out. */}
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => setDeleteTarget(product._id)}
                        disabled={busyId === product._id}
                        title="Delete permanently"
                        aria-label={`Delete ${product.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onChange={setPage} unit="products" />

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{editingProduct ? 'Edit Product' : 'New Product'}</h2>
            <button
              onClick={() => setShowModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Title</label>
                <input name="title" value={formData.title} onChange={handleChange} required />
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows="3" required />
              </div>

              <div className="form-group">
                <label>Price (₹)</label>
                <input name="price" type="number" value={formData.price} onChange={handleChange} required min="0" />
              </div>

              <div className="form-group">
                <label>Stock</label>
                <input name="stock" type="number" value={formData.stock} onChange={handleChange} required min="0" />
              </div>

              <div className="form-group">
                <label>Category</label>
                {/* Free-form input with autocomplete suggestions drawn
                    from categories already in use. Type a new value to
                    add a brand-new category, or pick an existing one
                    from the dropdown. */}
                <input
                  name="category"
                  list="product-category-suggestions"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g. Minimal, Abstract"
                  required
                  autoComplete="off"
                />
                {/* Individual labels, not whole stored strings: offering
                    "Marvel, Doom" as one option is how the taxonomy
                    splintered in the first place. */}
                <datalist id="product-category-suggestions">
                  {Array.from(
                    new Map(
                      products
                        .flatMap((p) => splitCategories(p.category))
                        .map((label) => [label.toLowerCase(), label])
                    ).values()
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((c) => (
                      <option key={c} value={c} />
                    ))}
                </datalist>
              </div>

              <div className="form-group full-width">
                <label>Sizes (comma separated)</label>
                <input name="sizes" value={formData.sizes} onChange={handleChange} placeholder="e.g. A4, A3, A2" />
              </div>

              <div className="form-group full-width">
                <label>Image</label>
                <div className="image-upload-zone" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files[0])}
                    id="img-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="img-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload size={24} />
                    <span style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {imageFile ? imageFile.name : 'Click to upload'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving || uploading}>
                {uploading ? 'Uploading…' : saving ? 'Saving…' : editingProduct ? 'Update' : 'Create'}
              </button>
            </div>
          </form>

          {/* Existing Images (only when editing) */}
          {editingProduct && editingProduct.images?.length > 0 && (
            <div className="modal-image-section">
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '0.9rem' }}>Existing Images</h3>
              <div className="image-preview-grid">
                {editingProduct.images.map((img) => (
                  <div key={img.publicId} className="preview-item">
                    <img src={img.url.replace('/upload/', '/upload/w_100,q_auto/')} alt="" />
                    <button
                      className="remove-img"
                      onClick={() => setImageDeleteTarget({ productId: editingProduct._id, publicId: img.publicId })}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Restock */}
      {restockTarget && (
        <RestockModal
          product={restockTarget}
          busy={busyId === restockTarget._id}
          onSave={handleRestock}
          onCancel={() => setRestockTarget(null)}
        />
      )}

      {/* Delete Product Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Product"
          message="Are you sure? This will permanently remove the product and its images. Past orders will keep their snapshot data but show the item as discontinued."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Delete Image Confirm */}
      {imageDeleteTarget && (
        <ConfirmModal
          title="Delete Image"
          message="Delete this image from cloud storage? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleImageRemove}
          onCancel={() => setImageDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Products;
