import { z } from 'zod';

export const productImageSchema = z.object({
  url: z.string(),
  variants: z.record(z.string()).optional(),
  publicId: z.string().optional(),
}).passthrough();

export const productSizeSchema = z.object({
  label: z.string(),
  priceModifier: z.number().finite().nullable().optional(),
}).passthrough();

export const productSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  price: z.number().finite().nonnegative(),
  category: z.string(),
  images: z.array(productImageSchema),
  stock: z.number().int().nonnegative(),
  sizes: z.array(productSizeSchema),
  isActive: z.boolean().optional(),
  createdAt: z.string().datetime().optional(),
}).passthrough();

export const assistantProductSchema = productSchema
  .pick({ _id: true, title: true, description: true, price: true, category: true, images: true, stock: true, sizes: true })
  .partial()
  .extend({
    _id: z.string().optional(),
    productId: z.string().optional(),
    title: z.string(),
    price: z.number().finite().nonnegative(),
    imageUrl: z.string().optional(),
    image: z.string().optional(),
  })
  .passthrough();
