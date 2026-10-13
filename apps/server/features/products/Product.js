import mongoose from 'mongoose';
import { normalizeCategories } from '../../utils/categories.js';

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    // One or more labels in a single comma-separated string. No enum: the
    // administrator manages the taxonomy and adds labels on the fly, and
    // the storefront filters are derived from what the catalogue actually
    // contains.
    //
    // The setter canonicalises on write — de-duplicated, trimmed, joined
    // with ", " — so "Marvel,doom" and "Marvel , Doom" converge on one
    // stored value instead of splintering the filter list. Read it back
    // into labels with splitCategories().
    category: {
      type: String,
      required: true,
      trim: true,
      set: normalizeCategories,
    },
    images: [
      {
        url: { type: String, required: true },       // Cloudinary-optimized URL
        publicId: { type: String, required: true }   // Public ID for deletion
      }
    ],
    stock: { type: Number, required: true, default: 0, min: 0 },
    sizes: [
      {
        label: String,    // Size label, e.g., "A4", "A3", "A2"
        priceModifier: Number  // Added to the base price
      }
    ],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  }
);

// Indexes for frequent query patterns.
productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ title: 'text' });

export default mongoose.models.Product || mongoose.model('Product', productSchema);
