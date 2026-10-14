import { z } from 'zod';
import { assistantProductSchema } from './product.js';

export { assistantProductSchema, productImageSchema, productSchema, productSizeSchema } from './product.js';

export const chatRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

export const assistantChatRequestSchema = chatRequestSchema;

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
