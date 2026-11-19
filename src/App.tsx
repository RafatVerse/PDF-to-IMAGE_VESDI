/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  FileUp,
  SlidersHorizontal,
  Download,
  RotateCw,
  Check,
  Sun,
  Moon,
  Trash2,
  Maximize2,
  FileText,
  Sparkles,
  ShieldCheck,
  Layers,
  Loader2,
  Keyboard,
} from 'lucide-react';
import {
  loadPdfDocument,
  renderPageThumbnail,
  renderPageToBlob,
  exportPages,
  triggerDownload,
  formatBytes,
  type PdfPageItem,
  type ImageFormat,
  type ExportScale,
  type DownloadMode,
} from './utils/pdfEngine';
import { SettingsPanel } from './components/SettingsPanel';
import { PageLightbox } from './components/PageLightbox';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Export settings
  const [format, setFormat] = useState<ImageFormat>('png');
  const [scale, setScale] = useState<ExportScale>(2);
  const [quality, setQuality] = useState<number>(0.9);
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('zip');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number } | null>(
    null
  );

  // Mobile sheet, lightbox, and shortcuts modal states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Native iOS / macOS Optical Cross-Dissolve Theme Transition
  const toggleTheme = useCallback(() => {
    const nextDark = !darkMode;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => {
        ready: Promise<void>;
        finished: Promise<void>;
      };
    };

    if (!docWithTransition.startViewTransition || prefersReducedMotion) {
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.classList.toggle('dark', nextDark);
      setDarkMode(nextDark);
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-transitioning');
      });
      return;
    }

    document.documentElement.classList.add('theme-transitioning');
    const transition = docWithTransition.startViewTransition(() => {
      flushSync(() => {
        document.documentElement.classList.toggle('dark', nextDark);
        setDarkMode(nextDark);
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          opacity: [0, 1],
          filter: ['blur(6px)', 'blur(0px)'],
          transform: ['scale(1.008)', 'scale(1)'],
        },
        {
          duration: 380,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );

      document.documentElement.animate(
        {
          opacity: [1, 0.6],
          filter: ['blur(0px)', 'blur(3px)'],
        },
        {
          duration: 380,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
          pseudoElement: '::view-transition-old(root)',
        }
      );
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  }, [darkMode]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  }, []);

  const handleFileLoad = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Please select a valid PDF document.', 'error');
        return;
      }

      setIsLoadingPdf(true);
      setLoadProgress(null);
      setPages([]);
      setLightboxIndex(null);

      try {
        const doc = await loadPdfDocument(file);
        setPdfDoc(doc);
        setFileMeta({ name: file.name, size: file.size });

        const total = doc.numPages;
        setLoadProgress({ current: 0, total });

        const loadedPages: PdfPageItem[] = new Array(total);
        const batchSize = 4;
        let renderedCount = 0;

        for (let start = 1; start <= total; start += batchSize) {
          const end = Math.min(start + batchSize - 1, total);
          const batchNumbers = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

          await Promise.all(
            batchNumbers.map(async (pageNum) => {
              const { thumbnailUrl, width, height } = await renderPageThumbnail(doc, pageNum);
              loadedPages[pageNum - 1] = {
                pageNumber: pageNum,
                thumbnailUrl,
                width,
                height,
                rotation: 0,
                selected: true,
              };
            })
          );

          renderedCount = end;
          setLoadProgress({ current: renderedCount, total });
          setPages(loadedPages.filter(Boolean));
        }

        showToast(`Loaded ${total} ${total === 1 ? 'page' : 'pages'} ready to convert.`);
      } catch (err) {
        console.error(err);
        showToast('Could not read this PDF. It may be corrupted or password-protected.', 'error');
        setPdfDoc(null);
        setFileMeta(null);
      } finally {
        setIsLoadingPdf(false);
        setLoadProgress(null);
      }
    },
    [showToast]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileLoad(file);
    }
  };

  const handleReset = () => {
    setPdfDoc(null);
    setFileMeta(null);
    setPages([]);
    setLightboxIndex(null);
    setIsSheetOpen(false);
  };

  const toggleSelectPage = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const selectAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: true })));
  };

  const deselectAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, selected: false })));
  };

  const rotatePage = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  const rotateSelectedPages = () => {
    setPages((prev) =>
      prev.map((p) => (p.selected ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleDownloadSingle = async (page: PdfPageItem) => {
    if (!pdfDoc || !fileMeta) return;
    try {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const cleanPrefix =
        fileMeta.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'document';
      const { blob } = await renderPageToBlob(pdfDoc, page.pageNumber, {
        format,
        scale,
        quality,
        rotation: page.rotation,
      });
      triggerDownload(blob, `${cleanPrefix}_page_${page.pageNumber}.${ext}`);
      showToast(`Saved Page ${page.pageNumber} as ${format.toUpperCase()}.`);
    } catch (err) {
      console.error(err);
      showToast('Failed to export image.', 'error');
    }
  };

  const handleExportSelected = async () => {
    if (!pdfDoc || !fileMeta) return;
    const selectedPages = pages.filter((p) => p.selected);
    if (selectedPages.length === 0) return;

    setIsExporting(true);
    setExportProgress({ completed: 0, total: selectedPages.length });

    try {
      await exportPages(
        pdfDoc,
        selectedPages,
        {
          format,
          scale,
          quality,
          filePrefix: fileMeta.name,
          downloadMode,
        },
        (completed, total) => setExportProgress({ completed, total })
      );
      setIsSheetOpen(false);
      showToast(
        selectedPages.length === 1
          ? `Exported 1 ${format.toUpperCase()} image.`
          : downloadMode === 'zip'
          ? `Exported ${selectedPages.length} images as ZIP.`
          : `Downloaded ${selectedPages.length} images separately.`
      );
    } catch (err) {
      console.error(err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const selectedCount = pages.filter((p) => p.selected).length;

  // Global Workspace Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in form inputs or contentEditable
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== 'range') ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // '?' toggles Shortcuts Help Modal from anywhere
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsOpen((open) => !open);
        return;
      }

      // When Shortcuts Modal or Lightbox is open, let them handle their own keys
      if (isShortcutsOpen || lightboxIndex !== null) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Cmd/Ctrl + O: Open PDF file
      if (mod && key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
        return;
      }

      // Cmd/Ctrl + S: Export selected pages
      if (mod && key === 's') {
        e.preventDefault();
        if (fileMeta && selectedCount > 0 && !isExporting) {
          handleExportSelected();
        }
        return;
      }

      // Cmd/Ctrl + A: Select all pages
      if (mod && key === 'a' && pages.length > 0) {
        e.preventDefault();
        selectAllPages();
        return;
      }

      // Esc: Close mobile sheet or deselect all pages
      if (e.key === 'Escape') {
        if (isSheetOpen) {
          e.preventDefault();
          setIsSheetOpen(false);
        } else if (selectedCount > 0) {
          e.preventDefault();
          deselectAllPages();
        }
        return;
      }

      // Single-key shortcuts (no modifiers)
      if (!mod && !e.altKey) {
        if (key === 't') {
          e.preventDefault();
          toggleTheme();
          return;
        }
        if (key === 'r' && pages.length > 0 && selectedCount > 0) {
          e.preventDefault();
          rotateSelectedPages();
          return;
        }
        if (key === 'p' && pages.length > 0) {
          e.preventDefault();
          const firstSelectedIdx = pages.findIndex((p) => p.selected);
          setLightboxIndex(firstSelectedIdx >= 0 ? firstSelectedIdx : 0);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isShortcutsOpen,
    lightboxIndex,
    isSheetOpen,
    fileMeta,
    pages,
    selectedCount,
    isExporting,
    toggleTheme,
  ]);

  return (
    <div
      className="min-h-screen flex flex-col ios-dot-canvas text-black dark:text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDraggingFile(false);
      }}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* iOS Dynamic Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#1C1C1E]/95 dark:bg-white/95 text-white dark:text-black text-[13px] font-medium shadow-xl backdrop-blur-xl flex items-center gap-2 max-w-[90vw]"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                toast.type === 'error' ? 'bg-[#FF3B30]' : 'bg-[#34C759]'
              }`}
            />
            <span className="truncate">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky iOS Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] rounded-lg"
          >
            <span className="w-8 h-8 rounded-[9px] bg-[#007AFF] dark:bg-[#0A84FF] text-white flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-[18px] font-bold tracking-tight">
              <span className="text-[#007AFF] dark:text-[#0A84FF]">VESDI</span> Folio
            </span>
          </button>

          {/* Center File Info (Desktop) */}
          {fileMeta && (
            <div className="hidden md:flex items-center gap-2 text-[13px] text-[#6C6C70] dark:text-[#98989F] min-w-0">
              <span className="font-medium text-black dark:text-white truncate max-w-[260px]">
                {fileMeta.name}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums whitespace-nowrap">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums whitespace-nowrap">
                {formatBytes(fileMeta.size)}
              </span>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#6C6C70] dark:text-[#98989F] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            >
              <Keyboard className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title="Toggle theme (T)"
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#6C6C70] dark:text-[#98989F] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={darkMode ? 'sun' : 'moon'}
                  initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  className="flex items-center justify-center"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </motion.span>
              </AnimatePresence>
            </button>

            {fileMeta && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-3.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] text-[13px] font-semibold hover:bg-[#007AFF]/15 dark:hover:bg-[#0A84FF]/28 transition-colors whitespace-nowrap shrink-0"
              >
                Open PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 md:pb-12">
        <AnimatePresence mode="wait">
          {!fileMeta && !isLoadingPdf ? (
            /* Empty / Dropzone State */
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl mx-auto pt-4 sm:pt-8 space-y-10"
            >
              <div className="text-center space-y-3">
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">
                  PDF to crisp images, instantly.
                </h1>
                <p className="text-[15px] sm:text-[17px] text-[#6C6C70] dark:text-[#98989F] max-w-xl mx-auto leading-relaxed">
                  Convert every page into lossless PNG, compact JPG, or WebP right on your device.
                  Private, fast, and crafted for touch and desktop.
                </p>
              </div>

              {/* iOS Elevated Dropzone Card */}
              <motion.div
                animate={{ scale: isDraggingFile ? 1.02 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`relative cursor-pointer rounded-[28px] p-8 sm:p-14 bg-white dark:bg-[#1C1C1E] border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-none ${
                  isDraggingFile
                    ? 'border-[#007AFF] bg-[#007AFF]/[0.04] dark:bg-[#0A84FF]/[0.08]'
                    : 'border-black/[0.10] dark:border-white/[0.14] hover:border-[#007AFF]/60 dark:hover:border-[#0A84FF]/60'
                }`}
              >
                <div className="w-16 h-16 rounded-[20px] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] flex items-center justify-center mb-5">
                  <FileUp className="w-8 h-8" />
                </div>

                <h2 className="text-[19px] sm:text-[21px] font-semibold tracking-tight mb-1.5">
                  {isDraggingFile ? 'Drop your PDF here' : 'Drop a PDF or tap to browse'}
                </h2>
                <p className="text-[14px] text-[#6C6C70] dark:text-[#98989F] mb-7">
                  Supports multi-page PDFs · Processed 100% locally in your browser
                </p>

                <div
                  className="flex items-center justify-center w-full sm:w-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto min-h-[48px] px-8 rounded-[14px] bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0071EB] text-white text-[15px] font-semibold shadow-[0_4px_14px_rgba(0,122,255,0.28)] transition-colors whitespace-nowrap"
                  >
                    Choose PDF File
                  </motion.button>
                </div>
              </motion.div>

              {/* Clean 3-column Capabilities Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1.5 px-2">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
                    <span>On-Device Privacy</span>
                  </div>
                  <p className="text-[13px] text-[#6C6C70] dark:text-[#98989F] leading-relaxed">
                    Your documents never leave your browser. All rendering runs locally on your
                    device.
                  </p>
                </div>

                <div className="space-y-1.5 px-2">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">
                    <Sparkles className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
                    <span>Up to 3× Ultra HD</span>
                  </div>
                  <p className="text-[13px] text-[#6C6C70] dark:text-[#98989F] leading-relaxed">
                    Choose Standard, Retina, or 216 DPI output with adjustable compression quality.
                  </p>
                </div>

                <div className="space-y-1.5 px-2">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">
                    <Layers className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
                    <span>Batch ZIP & Gestures</span>
                  </div>
                  <p className="text-[13px] text-[#6C6C70] dark:text-[#98989F] leading-relaxed">
                    Swipe through fullscreen previews, rotate individual pages, and export as a
                    single ZIP.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : isLoadingPdf && pages.length === 0 ? (
            /* Initial Loading State */
            <motion.div
              key="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-28 text-center space-y-4"
            >
              <Loader2 className="w-8 h-8 text-[#007AFF] dark:text-[#0A84FF] animate-spin" />
              <div className="space-y-1">
                <p className="text-[16px] font-semibold">Preparing pages…</p>
                {loadProgress && (
                  <p className="text-[13px] text-[#6C6C70] dark:text-[#98989F] tabular-nums">
                    Rendering {loadProgress.current} of {loadProgress.total}
                  </p>
                )}
              </div>
            </motion.div>
          ) : (
            /* Active Workspace */
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start"
            >
              {/* Left / Main Page Gallery */}
              <section className="space-y-4">
                {/* Workspace Subheader */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[20px] sm:text-[24px] font-bold tracking-tight truncate">
                      Pages
                    </h1>
                    <p className="text-[13px] text-[#6C6C70] dark:text-[#98989F] tabular-nums">
                      {selectedCount} of {pages.length} selected
                      {fileMeta && (
                        <span className="md:hidden"> · {formatBytes(fileMeta.size)}</span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[40px] px-3.5 rounded-full bg-white dark:bg-[#1C1C1E] text-[#FF3B30] text-[13px] font-medium flex items-center gap-1.5 hover:bg-[#FF3B30]/10 transition-colors shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>

                {/* Page Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                  {pages.map((page, index) => (
                    <motion.div
                      key={page.pageNumber}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.22 }}
                      className={`group relative rounded-[20px] bg-white dark:bg-[#1C1C1E] p-2.5 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-none ${
                        page.selected
                          ? 'ring-2 ring-[#007AFF] dark:ring-[#0A84FF]'
                          : 'ring-1 ring-black/[0.06] dark:ring-white/[0.08] opacity-75 hover:opacity-100'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div
                        onClick={() => setLightboxIndex(index)}
                        className="relative aspect-[3/4] w-full rounded-[12px] bg-[#F2F2F7] dark:bg-[#2C2C2E] overflow-hidden flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={page.thumbnailUrl}
                          alt={`Page ${page.pageNumber}`}
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                          className="w-full h-full object-contain transition-transform duration-300"
                        />

                        {/* Hover Expand Affordance (Desktop) */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md">
                            <Maximize2 className="w-4 h-4" />
                          </span>
                        </div>

                        {/* Top-Left iOS Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectPage(page.pageNumber);
                          }}
                          aria-label={
                            page.selected
                              ? `Deselect page ${page.pageNumber}`
                              : `Select page ${page.pageNumber}`
                          }
                          className="absolute top-1.5 left-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${
                              page.selected
                                ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white scale-100'
                                : 'bg-white/90 dark:bg-[#1C1C1E]/90 border border-black/20 dark:border-white/25 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        </button>
                      </div>

                      {/* Card Footer Controls */}
                      <div className="flex items-center justify-between pt-2.5 px-1">
                        <span className="text-[13px] font-semibold tabular-nums text-black dark:text-white">
                          Page {page.pageNumber}
                        </span>

                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => rotatePage(page.pageNumber)}
                            aria-label={`Rotate page ${page.pageNumber}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[#6C6C70] dark:text-[#98989F] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadSingle(page)}
                            aria-label={`Download page ${page.pageNumber}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/10 dark:hover:bg-[#0A84FF]/15 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Desktop Sticky Inspector Sidebar */}
              <aside className="hidden md:block sticky top-24 rounded-[24px] bg-white dark:bg-[#1C1C1E] p-5 lg:p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] dark:shadow-none border border-black/[0.05] dark:border-white/[0.07]">
                <h2 className="text-[17px] font-semibold tracking-tight mb-5">Export Settings</h2>
                <SettingsPanel
                  format={format}
                  onFormatChange={setFormat}
                  scale={scale}
                  onScaleChange={setScale}
                  quality={quality}
                  onQualityChange={setQuality}
                  downloadMode={downloadMode}
                  onDownloadModeChange={setDownloadMode}
                  selectedCount={selectedCount}
                  totalCount={pages.length}
                  onSelectAll={selectAllPages}
                  onDeselectAll={deselectAllPages}
                  onRotateSelected={rotateSelectedPages}
                  onExport={handleExportSelected}
                  isExporting={isExporting}
                  exportProgress={exportProgress}
                  layoutIdPrefix="desktop"
                />
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Sticky Bottom Action Bar (Thumb Zone) */}
      <AnimatePresence>
        {fileMeta && pages.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/88 dark:bg-[#1C1C1E]/88 backdrop-blur-xl border-t border-black/[0.08] dark:border-white/[0.10] px-4 pt-3 pb-safe"
          >
            <div className="flex items-center gap-3 max-w-lg mx-auto">
              <button
                type="button"
                onClick={() => setIsSheetOpen(true)}
                className="min-h-[48px] px-4 rounded-[14px] bg-[#F2F2F7] dark:bg-[#2C2C2E] text-black dark:text-white text-[14px] font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
                <span>{format.toUpperCase()} · {scale}×</span>
              </button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleExportSelected}
                disabled={selectedCount === 0 || isExporting}
                className="flex-1 min-h-[48px] px-5 rounded-[14px] bg-[#007AFF] dark:bg-[#0A84FF] disabled:opacity-45 text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,122,255,0.28)] whitespace-nowrap"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="tabular-nums">
                      {exportProgress?.completed ?? 0}/{exportProgress?.total ?? selectedCount}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {selectedCount === 0
                        ? 'Select Pages'
                        : selectedCount === 1
                        ? 'Export 1 Image'
                        : downloadMode === 'zip'
                        ? `Export ${selectedCount} (ZIP)`
                        : `Download ${selectedCount}`}
                    </span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Swipe-to-Dismiss iOS Bottom Sheet */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSheetOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 500) {
                  setIsSheetOpen(false);
                }
              }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white dark:bg-[#1C1C1E] px-5 pt-3 pb-safe shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Native iOS Grab Handle */}
              <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20 mx-auto mb-4" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-bold tracking-tight">Export Settings</h2>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  className="min-h-[36px] px-3 rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[13px] font-semibold text-[#007AFF] dark:text-[#0A84FF]"
                >
                  Done
                </button>
              </div>
              <SettingsPanel
                format={format}
                onFormatChange={setFormat}
                scale={scale}
                onScaleChange={setScale}
                quality={quality}
                onQualityChange={setQuality}
                downloadMode={downloadMode}
                onDownloadModeChange={setDownloadMode}
                selectedCount={selectedCount}
                totalCount={pages.length}
                onSelectAll={selectAllPages}
                onDeselectAll={deselectAllPages}
                onRotateSelected={rotateSelectedPages}
                onExport={handleExportSelected}
                isExporting={isExporting}
                exportProgress={exportProgress}
                layoutIdPrefix="mobile"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fullscreen Gesture Lightbox */}
      <PageLightbox
        pages={pages}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        onRotatePage={rotatePage}
        onToggleSelect={toggleSelectPage}
        onDownloadSingle={handleDownloadSingle}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
