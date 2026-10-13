// Four, not eight. These are a way in for someone who does not know what
// to ask — a long grid wrapped to four rows and read as a menu to work
// through. Each names a different *kind* of question (a franchise, a
// style, a price, availability), so the range of what Fabi can do stays
// obvious.
//
// Phrased the way someone would actually type into a chat rather than as
// commands aimed at a search box: "Show Marvel posters" is how you
// address a machine, "Got any Marvel?" is how you ask a person.
//
// "Surprise me" was tried here and cut — it promises a pick, and Fabi
// answers it by asking what you're after, which makes the chip feel
// broken.
const SUGGESTED_QUESTIONS = [
  'Got any Marvel?',
  'Something minimal',
  'Anything under ₹300?',
  "What's in stock?",
];

const FabiPrompts = ({ onSelectPrompt, disabled }) => (
  <div className="fabi-prompts-container">
    <p className="fabi-prompts-label">Not sure where to start?</p>
    <div className="fabi-prompts-chips">
      {SUGGESTED_QUESTIONS.map((question) => (
        <button
          key={question}
          type="button"
          className="fabi-chip-btn"
          onClick={() => onSelectPrompt(question)}
          disabled={disabled}
        >
          {question}
        </button>
      ))}
    </div>
  </div>
);

export default FabiPrompts;
