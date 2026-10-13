/**
 * One-off: rewrite existing category strings into their canonical form.
 *
 * The schema setter only fires on write, so rows saved before it existed
 * keep whatever the admin typed — "Abstract,Minimalist" with no space,
 * stray casing, repeated labels. The facet aggregation trims around the
 * separator so the shop is already correct without this, but running it
 * makes the stored data match what the setter would produce, which keeps
 * the filter regex and the admin autocomplete exactly in step.
 *
 * Safe to run more than once: rows already canonical are skipped.
 *
 *   node server/scripts/normalizeCategories.js          # report only
 *   node server/scripts/normalizeCategories.js --write  # apply
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../features/products/Product.js';
import { normalizeCategories } from '../utils/categories.js';

const apply = process.argv.includes('--write');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Run this from the repo root with apps/server/.env present.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Mode: ${apply ? 'WRITE' : 'dry run (pass --write to apply)'}\n`);

  const products = await Product.find({}, 'title category').lean();
  let changed = 0;

  for (const product of products) {
    const next = normalizeCategories(product.category);
    if (next === product.category) continue;

    changed += 1;
    console.log(`  ${product.title}`);
    console.log(`    ${JSON.stringify(product.category)}  ->  ${JSON.stringify(next)}`);

    if (apply) {
      // updateOne bypasses the setter, so the value is normalised here.
      await Product.collection.updateOne(
        { _id: product._id },
        { $set: { category: next } }
      );
    }
  }

  console.log(
    changed === 0
      ? '\nEvery category is already canonical. Nothing to do.'
      : `\n${changed} of ${products.length} product(s) ${apply ? 'updated' : 'would change'}.`
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
