import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils';

/* Inline, in-context messaging — the banner form of Field's error. Each
   tone pairs an icon with the text so the meaning survives without
   colour, which matters doubly here: in this palette success and info are
   both plain ink, and only the icon distinguishes them. */
const TONES = {
  info: { Icon: Info, cls: 'border-border-strong text-foreground' },
  success: { Icon: CheckCircle2, cls: 'border-border-strong text-foreground' },
  warning: { Icon: TriangleAlert, cls: 'border-border-strong text-foreground' },
  error: { Icon: AlertCircle, cls: 'border-destructive text-destructive' },
};

const Alert = ({ className, tone = 'info', title, children, ...props }) => {
  const { Icon, cls } = TONES[tone] ?? TONES.info;

  return (
    <div
      // Errors interrupt; everything else is polite.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 border bg-transparent p-4', cls, className)}
      {...props}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {title && (
          <p className="font-sans text-label font-semibold uppercase tracking-label">{title}</p>
        )}
        {children && <div className="font-sans text-meta leading-relaxed opacity-80">{children}</div>}
      </div>
    </div>
  );
};

export { Alert };
