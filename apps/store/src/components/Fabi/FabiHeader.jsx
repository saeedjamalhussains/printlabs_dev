import { X } from 'lucide-react';
import fabiDark from '@brand/fabi_dark.png';
import { ThemedImage } from '@printlabs/ui';
import fabiLight from '@brand/fabi_light.png';

/**
 * Chat header.
 *
 * Deliberately sparse. It previously carried an avatar with a pulsing
 * badge, the name, an "AI ASSISTANT" pill, a status line, and two
 * buttons — six pieces of chrome above a panel whose actual job is the
 * conversation.
 *
 * The second button is gone too: "minimize" and "close" both called the
 * same handler, so the panel offered two controls that behaved
 * identically while their tooltips promised otherwise.
 */
const FabiHeader = ({ onClose }) => {

  return (
    <div className="fabi-header">
      <div className="fabi-header-info">
        {/* Inverted against the Navbar mark,
            and deliberately so: the avatar sits on --primary-color, which is
            black in light mode and white in dark. The mark has to contrast
            with that disc, not with the page. */}
        <ThemedImage
          srcLight={fabiLight}
          srcDark={fabiDark}
          alt=""
          aria-hidden="true"
          className="fabi-avatar"
        />
        <h3 className="fabi-name">Fabi</h3>
      </div>

      <button
        type="button"
        className="fabi-icon-btn"
        onClick={onClose}
        aria-label="Close chat"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default FabiHeader;
