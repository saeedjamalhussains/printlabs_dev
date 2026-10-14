import { asyncHandler } from '../../middleware/asyncHandler.js';
import { searchCatalogue } from './productSearch.js';
import { isPaymentQuery } from '@printlabs/guards';
import { buildSuggestions } from './suggestions.js';
import { tokenize } from './productSearch.js';
import { withSignedImagesAll } from '../images/productImages.js';
import env from '../../config/env.js';
import {
  chatRequestSchema,
  chatApiResponseSchema,
  assistantChatResponseSchema,
} from '@printlabs/schemas';


/**
 * Shape every bot reply the same way.
 *
 * `id` and `timestamp` must be evaluated per reply. They previously sat
 * in a module-level object literal, so both were fixed at import time:
 * every payment refusal carried the server's start time and an identical
 * id, which also collides as a React key when two land in one session.
 */
const botMessage = (fields) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sender: 'bot',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  ...fields,
});

const paymentRefusal = () => botMessage({
  text: "That one's outside what I can help with, I'm afraid. I stick to the posters, what's in stock and what might suit you. For anything about payments or billing, our support team are the people to ask.",
  isPaymentRefusal: true,
  action: {
    label: 'Contact Support',
    href: 'mailto:support@printlabs.com?subject=Payment%20Assistance'
  }
});

// Never ship more than the widget renders.
const MAX_SUGGESTIONS = 4;

// Give up on the AI service after this and answer from MongoDB instead.
const AI_TIMEOUT_MS = env.AI_TIMEOUT_MS;

// Mirrors the storefront card projection — the chat widget shows a card
// per product, so it needs no more than this.
const SUGGESTION_FIELDS = 'title price category images stock sizes';

export const chatWithAssistant = asyncHandler(async (req, res) => {
  const request = chatRequestSchema.safeParse(req.body);

  if (!request.success) {
    return res.status(400).json({
      success: false,
      message: 'A non-empty query of at most 500 characters is required.'
    });
  }
  const { query } = request.data;

  // 1. Strict Payment Check Guardrail
  if (isPaymentQuery(query)) {
    return res.status(200).json(chatApiResponseSchema.parse({
      success: true,
      data: paymentRefusal(),
    }));
  }

  const aiServiceUrl = env.AI_SERVICE_URL;
  const internalApiKey = env.INTERNAL_API_KEY;

  try {
    // 2. Call FastAPI RAG Microservice
    //
    // The timeout is what makes the fallback below reachable. Node's
    // fetch has no default, and the fallback only runs on a throw or a
    // non-ok status — so a *hung* AI service (the most likely unhealthy
    // state) held the request open until the browser gave up at 60s, and
    // the customer got nothing. Aborting turns a hang into a throw.
    //
    // Sized above the AI service's own 12s OpenRouter timeout so a slow
    // LLM still gets to answer; anything past that is not coming.
    const response = await fetch(`${aiServiceUrl}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': internalApiKey
      },
      body: JSON.stringify({ query: query.trim() }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (response.ok) {
      const result = assistantChatResponseSchema.parse(await response.json());
      const products = result.products || [];
      return res.status(200).json(chatApiResponseSchema.parse({
        success: true,
        data: botMessage({
          text: result.answer,
          // Same signing boundary as the catalogue endpoints — the
          // assistant must not become a way to obtain unsigned URLs.
          products: withSignedImagesAll(products),
          suggestions: await buildSuggestions({ products, terms: tokenize(query) }),
        }),
      }));
    }
    console.warn(`AI microservice returned ${response.status}; using MongoDB fallback.`);
  } catch (err) {
    const reason = err.name === 'TimeoutError'
      ? `did not respond within ${AI_TIMEOUT_MS}ms`
      : err.message;
    console.warn(`AI microservice ${reason}; using MongoDB fallback.`);
  }

  // 3. Fallback: search MongoDB directly if the Python service is offline.
  //    Word-level matching and ranking live in productSearch.js.
  const { products, matched, terms } = await searchCatalogue(query, {
    limit: MAX_SUGGESTIONS,
    fields: SUGGESTION_FIELDS,
  });

  // Say what was actually searched for. Echoing the raw sentence back
  // ("Found 4 posters matching 'do you have any marvel posters?'") reads
  // as though the whole phrase was matched, which it was not.
  const searchedFor = terms.length ? terms.join(', ') : query;

  return res.status(200).json(chatApiResponseSchema.parse({
    success: true,
    data: botMessage({
      // Plain and human. The trailing-colon "Found 3 posters for x:"
      // read like a search-results header rather than someone answering,
      // and "popular posters" was a claim we have no data to make.
      text: matched
        ? `Here's what I found for ${searchedFor}.`
        : `Nothing came up for ${searchedFor}, so here's a few others in case one catches your eye.`,
      products: withSignedImagesAll(products),
      suggestions: await buildSuggestions({ products, terms }),
    }),
  }));
});
