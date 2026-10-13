/**
 * An image with a light and a dark artwork, chosen by the system colour
 * scheme.
 *
 * This replaces `isDarkMode ? a : b`. The point of doing it with
 * <picture> rather than in React is that the choice is then made by the
 * browser, from CSS, before the first paint — a JavaScript flag cannot
 * decide until the component has mounted, so the wrong logo is painted
 * first and visibly swaps. It also means the artwork follows the system
 * setting live, with no listener to subscribe to or clean up.
 *
 * `srcLight` is the file to show under a light scheme, `srcDark` under a
 * dark one — named for the scheme rather than for the artwork, because
 * for a logo the two are inverted and naming them after the file is how
 * that gets mixed up.
 */
const ThemedImage = ({ srcLight, srcDark, alt, ...props }) => (
  <picture>
    <source srcSet={srcDark} media="(prefers-color-scheme: dark)" />
    <img src={srcLight} alt={alt} {...props} />
  </picture>
);

export default ThemedImage;
