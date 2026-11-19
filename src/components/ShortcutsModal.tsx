import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const MOD_KEY = isMac ? '⌘' : 'Ctrl';

const WORKSPACE_SHORTCUTS: ShortcutItem[] = [
  { keys: [MOD_KEY, 'O'], description: 'Open PDF file' },
  { keys: [MOD_KEY, 'S'], description: 'Export selected pages' },
  { keys: [MOD_KEY, 'A'], description: 'Select all pages' },
  { keys: ['Esc'], description: 'Deselect all / Close modal' },
  { keys: ['R'], description: 'Rotate selected pages 90°' },
  { keys: ['P'], description: 'Inspect first page in preview' },
  { keys: ['T'], description: 'Toggle Light / Dark theme' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

const PREVIEW_SHORTCUTS: ShortcutItem[] = [
  { keys: ['+'], description: 'Zoom in' },
  { keys: ['-'], description: 'Zoom out' },
  { keys: ['0'], description: 'Reset zoom & pan to 100%' },
  { keys: ['←', '→', '↑', '↓'], description: 'Pan when zoomed · Switch pages at 100%' },
  { keys: ['Shift', 'Arrows'], description: 'Fast pan when zoomed in' },
  { keys: ['[', ']'], description: 'Previous / Next page (any zoom)' },
  { keys: ['PgUp', 'PgDn'], description: 'Previous / Next page (any zoom)' },
  { keys: ['R'], description: 'Rotate current page 90°' },
  { keys: ['S'], description: 'Toggle select current page' },
  { keys: [MOD_KEY, 'S'], description: 'Save current page image' },
  { keys: ['Esc'], description: 'Close fullscreen preview' },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm"
          />

          {/* Modal Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.10] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-[10px] bg-[#007AFF]/10 dark:bg-[#0A84FF]/18 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center">
                  <Keyboard className="w-4 h-4" />
                </span>
                <div>
                  <h2
                    id="shortcuts-modal-title"
                    className="text-[17px] font-semibold tracking-tight text-black dark:text-white leading-tight"
                  >
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-[12px] text-[#6C6C70] dark:text-[#98989F]">
                    Navigate and convert faster on desktop
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[#6C6C70] dark:text-[#98989F] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Workspace Section */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[#6C6C70] dark:text-[#98989F] px-1">
                  Workspace
                </h3>
                <div className="rounded-[16px] bg-[#F2F2F7]/80 dark:bg-[#2C2C2E]/70 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {WORKSPACE_SHORTCUTS.map((item) => (
                    <div
                      key={item.description}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <span className="text-[13px] text-black dark:text-white leading-snug">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, idx) => (
                          <kbd
                            key={`${key}-${idx}`}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-[7px] bg-white dark:bg-[#3A3A3C] border border-black/[0.08] dark:border-white/[0.12] text-[11px] font-semibold text-black dark:text-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] tabular-nums"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fullscreen Preview Section */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[#6C6C70] dark:text-[#98989F] px-1">
                  Fullscreen Preview
                </h3>
                <div className="rounded-[16px] bg-[#F2F2F7]/80 dark:bg-[#2C2C2E]/70 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                  {PREVIEW_SHORTCUTS.map((item) => (
                    <div
                      key={item.description}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <span className="text-[13px] text-black dark:text-white leading-snug">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, idx) => (
                          <kbd
                            key={`${key}-${idx}`}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-[7px] bg-white dark:bg-[#3A3A3C] border border-black/[0.08] dark:border-white/[0.12] text-[11px] font-semibold text-black dark:text-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] tabular-nums"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
