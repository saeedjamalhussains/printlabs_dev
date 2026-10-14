import api from './api';
import { isPaymentQuery } from '@printlabs/guards';
import { chatApiResponseSchema, chatRequestSchema } from '@printlabs/schemas';

export { isPaymentQuery };

const botMessage = (fields) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sender: 'bot',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  ...fields,
});

/**
 * Refusal for payment questions.
 *
 * Checked here as well as on the server so an obvious payment question
 * never costs a round trip. The server checks again because the client
 * cannot be trusted; both read the same rules from @printlabs/guards.
 */
export const getPaymentRefusalResponse = () => botMessage({
  // Kept word-for-word in step with paymentRefusal() in
  // apps/server/features/ai/aiController.js. The client answers first to save
  // a round trip and the server answers again for anything that slips
  // past, so a customer must not get two different refusals depending on
  // which layer caught it.
  text: "That one's outside what I can help with, I'm afraid. I stick to the posters, what's in stock and what might suit you. For anything about payments or billing, our support team are the people to ask.",
  isPaymentRefusal: true,
  action: {
    label: 'Contact Support',
    href: 'mailto:support@printlabs.com?subject=Payment%20Assistance',
  },
});

/**
 * Send a question to Fabi.
 *
 * There is deliberately no local product search here any more. The old
 * fallback re-implemented the catalogue search in the browser and ran
 * only when the API call had already failed — at which point its own
 * `fetchInventory()` request failed too, so it produced an empty result
 * dressed up as an answer. It had also drifted: it matched the customer's
 * whole sentence as one string and filtered on `description`, which the
 * catalogue endpoint does not return by default.
 *
 * The server already falls back to a MongoDB keyword search when the AI
 * service is down, so the only case reaching this catch is the API itself
 * being unreachable — and then the honest answer is to say so.
 */
export const processUserQuery = async (queryText) => {
  if (isPaymentQuery(queryText)) {
    return getPaymentRefusalResponse();
  }

  const request = chatRequestSchema.safeParse({ query: queryText });
  if (!request.success) {
    return botMessage({ text: 'Could you shorten that question and try again?' });
  }

  try {
    const { data } = await api.post('/chat', request.data);
    return chatApiResponseSchema.parse(data).data;
  } catch (error) {
    // A 401 means the session ended mid-conversation.
    if (error?.response?.status === 401) {
      return botMessage({
        text: "Looks like you've been signed out. Sign back in and we can pick up where we left off.",
        action: { label: 'Sign in', href: '/login' },
      });
    }

    console.warn('Fabi request failed:', error?.message);
    return botMessage({
      text: "I can't reach the catalogue at the moment. Give it a few seconds and try again.",
    });
  }
};
