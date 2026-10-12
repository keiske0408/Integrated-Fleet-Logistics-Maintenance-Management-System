import * as React from 'react';
import { Trash2, Lock, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog } from './dialog';
import { Button } from './button';

export type ConfirmVariant = 'destructive' | 'warning' | 'info' | 'primary' | 'success';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  children?: React.ReactNode;
  badge?: React.ReactNode;
  confirmDisabled?: boolean;
  className?: string;
  closeOnBackdropClick?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  icon: CustomIcon,
  isLoading = false,
  children,
  badge,
  confirmDisabled = false,
  className,
  closeOnBackdropClick = true,
}: ConfirmDialogProps) {
  const handleClose = () => {
    if (isLoading) return;
    if (onCancel) onCancel();
    if (onOpenChange) onOpenChange(false);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirm();
  };

  const variantMap = {
    destructive: {
      defaultIcon: Trash2,
      iconWrapper:
        'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 shadow-sm shadow-red-500/10',
      buttonVariant: 'destructive' as const,
      buttonClass: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    },
    warning: {
      defaultIcon: Lock,
      iconWrapper:
        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-sm shadow-amber-500/10',
      buttonVariant: 'warning' as const,
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm',
    },
    info: {
      defaultIcon: Info,
      iconWrapper:
        'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 shadow-sm shadow-sky-500/10',
      buttonVariant: 'default' as const,
      buttonClass: '',
    },
    primary: {
      defaultIcon: CheckCircle2,
      iconWrapper: 'bg-primary/10 text-primary border-primary/20 shadow-sm shadow-primary/10',
      buttonVariant: 'default' as const,
      buttonClass: '',
    },
    success: {
      defaultIcon: CheckCircle2,
      iconWrapper:
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm shadow-emerald-500/10',
      buttonVariant: 'success' as const,
      buttonClass: '',
    },
  };

  const config = variantMap[variant] ?? variantMap.destructive;
  const IconToRender = CustomIcon || config.defaultIcon;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onClose={handleClose}
      className={cn('max-w-lg w-full', className)}
      showCloseButton={!isLoading}
      closeOnBackdropClick={!isLoading && closeOnBackdropClick}
      closeOnEscape={!isLoading}
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Header with Icon, Title, and Badge */}
        <div className="flex items-start gap-3.5 sm:gap-4 pr-6 sm:pr-8">
          <div
            className={cn(
              'flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200',
              config.iconWrapper,
            )}
          >
            <IconToRender className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
                {title}
              </h3>
              {badge}
            </div>
            {description && (
              <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                {description}
              </div>
            )}
          </div>
        </div>

        {/* Custom Body / Details */}
        {children && <div className="space-y-3">{children}</div>}

        {/* Responsive Actions Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm font-medium order-2 sm:order-1"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            onClick={handleConfirm}
            disabled={isLoading || confirmDisabled}
            className={cn(
              'w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm font-medium order-1 sm:order-2',
              config.buttonClass,
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
