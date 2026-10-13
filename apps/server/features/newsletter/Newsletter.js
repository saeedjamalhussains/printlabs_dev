import mongoose from 'mongoose';

/**
 * One newsletter "drop" entry. Admin publishes via the admin panel;
 * the public Newsletter page reads the list and renders the entries.
 */
const newsletterSchema = new mongoose.Schema(
  {
    title:     { type: String, required: true, trim: true, maxlength: 140 },
    body:      { type: String, required: true, trim: true, maxlength: 4000 },
    imageUrl:  { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

newsletterSchema.index({ createdAt: -1 });

export default mongoose.models.Newsletter || mongoose.model('Newsletter', newsletterSchema);
