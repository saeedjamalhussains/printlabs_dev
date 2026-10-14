import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import FabiHeader from './FabiHeader';
import FabiPrompts from './FabiPrompts';
import FabiMessages from './FabiMessages';
import FabiInput from './FabiInput';
import { processUserQuery } from '../../services/fabiService';
import { useAuth } from '../../hooks/useAuth';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import fabiDark from '@brand/fabi_dark.png';
import { ThemedImage } from '@printlabs/ui';
import fabiLight from '@brand/fabi_light.png';
import './Fabi.css';

// Minimum time the typing indicator stays up, so it does not flash on a
// fast keyword-fallback reply.
const TYPING_FLOOR_MS = 150;

// Built lazily so the timestamp is the moment the widget mounts.
const welcomeMessage = () => ({
  id: 'welcome-1',
  sender: 'bot',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  text: "Hey, I'm Fabi. Tell me what you're after, a character, a colour, a mood, and I'll dig through the walls for you.",
  // Sets expectations without a separate banner. It used to be a boxed
  // card with its own icon and dashed rule, restating the greeting.
  note: 'Posters and inventory only. For payment or billing, our support team can help.',
});

const Fabi = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Seeded directly rather than set from an effect — the welcome message
  // is the component's initial state, not a reaction to anything.
  const [messages, setMessages] = useState(() => [welcomeMessage()]);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const { pathname } = useLocation();

  // The widget is mounted outside <Routes>, so it also floated over the
  // sign-in and registration screens. Now that opening it redirects to
  // sign-in, leaving it there would let someone bounce /login → /login.
  // It has no place on those pages regardless.
  const onAuthScreen = pathname === '/login' || pathname === '/register';

  /**
   * The trigger stays visible when signed out — it is how visitors learn
   * the assistant exists — but opening it needs an account. The server
   * enforces the same rule on /api/chat; this only saves the round trip
   * and explains why.
   */
  const handleOpen = () => {
    if (!requireAuth('chat with Fabi')) return;
    setIsOpen(true);
  };

  const handleSendMessage = async (queryText) => {
    // Belt and braces: a session can expire while the panel sits open.
    if (!requireAuth('chat with Fabi')) {
      setIsOpen(false);
      return;
    }

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: queryText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Measured: retrieval is ~3ms and the LLM call is 1.5-3.5s, so the
    // typing indicator is on screen for a real interval on its own. The
    // floor exists only for the keyword-fallback path, which answers in
    // tens of milliseconds and would otherwise flash the indicator.
    // It was 600ms, which was 40% of a fast reply spent waiting on
    // nothing.
    const [botResponse] = await Promise.all([
      processUserQuery(queryText),
      new Promise((resolve) => setTimeout(resolve, TYPING_FLOOR_MS)),
    ]);

    setMessages((prev) => [...prev, botResponse]);
    setIsTyping(false);
  };

  // The greeting is seeded by us; a real conversation starts at the
  // customer's first message.
  const hasConversation = messages.some((m) => m.sender === 'user');

  if (onAuthScreen) return null;

  return (
    <div className="fabi-container">
      {/* Floating Action Button (Fixed Bottom-Right) */}
      {!isOpen && (
        <button
          type="button"
          className="fabi-trigger-btn"
          onClick={handleOpen}
          aria-label="Open Fabi, the customer assistant"
          title={user ? 'Chat with Fabi' : 'Sign in to chat with Fabi'}
        >
          {/* Mark only. The name is the panel's job once it is open; on
              the closed launcher it repeated what the ƒ already says.
              The button keeps its aria-label, so screen readers still
              get "Open Fabi, the customer assistant". */}
          <ThemedImage
            srcLight={fabiLight}
          srcDark={fabiDark}
            alt=""
            aria-hidden="true"
            className="fabi-trigger-logo"
          />
        </button>
      )}

      {/* Floating Chat Drawer / Window */}
      {isOpen && (
        <div className="fabi-window" role="dialog" aria-label="Chat with Fabi">
          {/* Header */}
          <FabiHeader onClose={() => setIsOpen(false)} />

          {/* Chat Body */}
          <div className="fabi-body">
            <FabiMessages
              messages={messages}
              isTyping={isTyping}
              onCloseChat={() => setIsOpen(false)}
              onSelectSuggestion={handleSendMessage}
            />

            {/* Openers, shown until the conversation starts. They are a
                way in for someone who does not know what to ask, not
                permanent furniture — they used to sit above the thread
                for the whole session, taking a third of the panel. */}
            {!hasConversation && (
              <FabiPrompts
                onSelectPrompt={handleSendMessage}
                disabled={isTyping}
              />
            )}
          </div>

          {/* Input Area */}
          <FabiInput
            onSendMessage={handleSendMessage}
            disabled={isTyping}
          />
        </div>
      )}
    </div>
  );
};

export default Fabi;
