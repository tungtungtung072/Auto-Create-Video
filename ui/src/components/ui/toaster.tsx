import { useToastStore } from './use-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg p-4 shadow-lg border min-w-[300px]",
              toast.variant === 'destructive' 
                ? "bg-[var(--color-danger)] text-white border-transparent" 
                : "bg-[var(--surface-color)] text-[var(--text-primary)] border-[var(--border-color)]"
            )}
          >
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold">{toast.title}</h4>
              {toast.description && (
                <p className="text-sm opacity-90">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="mt-0.5 rounded-md p-1 opacity-70 hover:opacity-100 bg-black/10 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
