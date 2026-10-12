import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Global counter to track active modals for body scroll lock
let activeModalCount = 0;

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  onClose,
  children,
  className,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: DialogProps) {
  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  }, [onClose, onOpenChange]);

  // Lock body scroll and register Escape key handler
  React.useEffect(() => {
    if (!open) return;

    activeModalCount++;
    if (activeModalCount === 1) {
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = '';
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeOnEscape, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Standardized Dark Tint Backdrop with Blur Effect */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={closeOnBackdropClick ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-7 shadow-2xl text-card-foreground',
          'animate-fade-in focus:outline-none my-auto sm:my-8 max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-left mb-4 sm:mb-5 pr-6 sm:pr-8', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      'text-lg sm:text-xl font-bold leading-snug tracking-tight text-foreground break-words',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs sm:text-sm text-muted-foreground leading-relaxed', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-4 sm:pt-5 border-t border-border/50 mt-4 [&>button]:w-full [&>button]:sm:w-auto',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

// Aliases for Modal naming convention
export {
  Dialog as Modal,
  DialogHeader as ModalHeader,
  DialogTitle as ModalTitle,
  DialogDescription as ModalDescription,
  DialogFooter as ModalFooter,
};
export type ModalProps = DialogProps;

export * from './confirm-dialog';
