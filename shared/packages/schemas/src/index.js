import { z } from 'zod';

export const chatRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

export const assistantChatRequestSchema = chatRequestSchema;

export const assistantProductSchema = z.object({
  _id: z.string().optional(),
  productId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  price: z.number().finite().nonnegative(),
  category: z.string().optional(),
  images: z.array(z.object({
    url: z.string().optional(),
    publicId: z.string().optional(),
  }).passthrough()).optional(),
  stock: z.number().int().nonnegative().optional(),
  sizes: z.array(z.object({
    label: z.string(),
    priceModifier: z.number().finite().optional(),
  }).passthrough()).optional(),
}).passthrough();

export const assistantChatResponseSchema = z.object({
  answer: z.string(),
  products: z.array(assistantProductSchema),
});

export const chatApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    sender: z.literal('bot'),
    timestamp: z.string(),
    text: z.string(),
    products: z.array(assistantProductSchema).optional(),
    suggestions: z.array(z.string()).optional(),
    isPaymentRefusal: z.boolean().optional(),
    action: z.object({ label: z.string(), href: z.string() }).optional(),
  }).passthrough(),
});
