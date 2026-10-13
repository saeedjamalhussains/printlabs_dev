import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* tailwind-merge resolves conflicts by grouping class names, and it only
   knows the groups for Tailwind default scales. This theme renames the
   font-size scale to role names (text-label, text-meta, …), and without
   telling the merger about them it classifies `text-label` as a *text
   colour* — the same group as `text-primary-foreground` — and drops
   whichever came first.

   That silently removed the colour from every button that set both a size
   and a colour, which is most of them: `bg-primary text-primary-foreground
   … text-micro` merged down to white-on-white.

   So the custom scales are declared here. Anything added to the type or
   tracking scale in styles/theme.css has to be added here too. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro', 'meta', 'label', 'caption',
            'sm', 'base', 'md', 'lg', 'xl', '2xl',
            'title', 'display',
          ],
        },
      ],
      tracking: [{ tracking: ['heading', 'label', 'button'] }],
      rounded: [{ rounded: ['pill'] }],
    },
  },
});

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones
 * of the same kind. Used by every component under components/ui so a caller
 * can override any default with a plain `className`.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
