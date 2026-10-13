import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '../lib/utils';

/* Square, initials-first. The fallback is not a decorative silhouette —
   initials identify the account, which is the point. */
const Avatar = ({ className, ...props }) => (
  <AvatarPrimitive.Root
    className={cn(
      'relative inline-flex size-9 shrink-0 select-none items-center justify-center overflow-hidden',
      'border border-border-strong bg-transparent',
      className
    )}
    {...props}
  />
);

const AvatarImage = ({ className, ...props }) => (
  <AvatarPrimitive.Image className={cn('size-full object-cover', className)} {...props} />
);

const AvatarFallback = ({ className, ...props }) => (
  <AvatarPrimitive.Fallback
    className={cn(
      'inline-flex size-full items-center justify-center',
      'font-serif text-micro font-bold uppercase tracking-label text-foreground',
      className
    )}
    {...props}
  />
);

export { Avatar, AvatarImage, AvatarFallback };
