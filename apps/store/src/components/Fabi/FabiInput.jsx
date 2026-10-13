import { useState } from 'react';
import { Send } from 'lucide-react';

const FabiInput = ({ onSendMessage, disabled }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="fabi-input-container" onSubmit={handleSubmit}>
      <input
        type="text"
        className="fabi-input-field"
        placeholder="Ask about posters, categories, search..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Message input for Fabi"
      />
      <button
        type="submit"
        className="fabi-send-btn"
        disabled={!text.trim() || disabled}
        aria-label="Send message"
      >
        <Send size={14} />
      </button>
    </form>
  );
};

export default FabiInput;
