import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { posterSources } from '../../utils/imageQuality';
import './PosterImage.css';

/**
 * One poster image, delivered at the size it is actually drawn at.
 *
 * The sequence is deliberately three steps and no more:
 *
 *   reserved box  →  tiny blurred preview  →  correctly sized image
 *
 * The box is reserved by aspect-ratio before anything is requested, so
 * nothing on the page moves when the picture lands. The preview is ~24px
 * wide and costs a few hundred bytes, which is there to stop a grid
 * looking like a page of empty rectangles — it is never the final
 * representation, and it is removed the moment the real file decodes.
 *
 * Exactly two requests are made per poster: the preview and the chosen
 * rung. The browser picks the rung from `sizes` and the device pixel
 * ratio, so a phone drawing this at 160px never fetches the 800px file.
 */
const PosterImage = ({
  url,
  /** Signed variant ladder from the API. Preferred over `url` when present. */
  variants = null,
  alt,
  /** How wide this is actually laid out. Drives which rung is chosen. */
  sizes = '100vw',
  /** Largest CSS width this component ever renders at. */
  maxWidth = 400,
  /** 3/4 matches the shop card and the suggestion rail. */
  aspectRatio = '3 / 4',
  /** Set for the one image that is the page's main content. */
  priority = false,
  className = '',
  onLoad,
  ...props
}) => {
  const [status, setStatus] = useState('loading');
  const { src, srcSet, sizes: sizesAttr, lqip } = posterSources(url, { sizes, maxWidth, variants });

  const failed = status === 'error' || !src;

  return (
    <div
      className={`poster-image ${className}`.trim()}
      style={{ aspectRatio }}
      data-status={status}
    >
      {/* The preview sits behind the real image as a background rather
          than as a second <img>, so it cannot be picked up by the
          browser as a separate layout box and cannot shift anything. */}
      {lqip && !failed && (
        <span
          className="poster-image-lqip"
          style={{ backgroundImage: `url(${lqip})` }}
          aria-hidden="true"
        />
      )}

      {!failed && (
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes={srcSet ? sizesAttr : undefined}
          alt={alt}
          /* Above-the-fold imagery loads immediately and is hinted as
             high priority; everything else waits until it is near the
             viewport. Getting this backwards is what makes a grid feel
             slow, so it is an explicit prop rather than a guess. */
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          draggable={false}
          onLoad={(event) => { setStatus('loaded'); onLoad?.(event); }}
          /* No retry loop: a failed image URL almost always fails again,
             and retrying turns one bad request into many. */
          onError={() => setStatus('error')}
          {...props}
        />
      )}

      {failed && (
        <span className="poster-image-fallback">
          <ImageOff size={18} strokeWidth={1.25} aria-hidden="true" />
          <span>Image unavailable</span>
        </span>
      )}
    </div>
  );
};

export default PosterImage;
