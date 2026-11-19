import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  ZoomIn,
  ZoomOut,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { PdfPageItem } from '../utils/pdfEngine';

interface PageLightboxProps {
  pages: PdfPageItem[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onRotatePage: (pageNumber: number) => void;
  onToggleSelect: (pageNumber: number) => void;
  onDownloadSingle: (page: PdfPageItem) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function PageLightbox({
  pages,
  activeIndex,
  onClose,
  onNavigate,
  onRotatePage,
  onToggleSelect,
  onDownloadSingle,
}: PageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; time: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const isOpen = activeIndex !== null && pages[activeIndex] !== undefined;
  const currentPage = isOpen ? pages[activeIndex] : null;

  const clampZoom = useCallback((val: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(val * 100) / 100));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const updateZoom = useCallback(
    (nextZoom: number) => {
      const clamped = clampZoom(nextZoom);
      setZoom(clamped);
      if (clamped <= 1) {
        setPan({ x: 0, y: 0 });
      }
    },
    [clampZoom]
  );

  // Reset zoom & pan when switching pages or opening
  useEffect(() => {
    resetView();
  }, [activeIndex, resetView]);

  // Desktop keyboard shortcuts: Zoom (+/-, 0), Pan (Arrows when zoomed), Page Nav (Arrows / [ ])
  useEffect(() => {
    if (!isOpen || activeIndex === null || !currentPage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === '+' || e.key === '=' || ((e.metaKey || e.ctrlKey) && e.key === '=')) {
        e.preventDefault();
        updateZoom(zoom + ZOOM_STEP);
        return;
      }

      if (e.key === '-' || e.key === '_' || ((e.metaKey || e.ctrlKey) && e.key === '-')) {
        e.preventDefault();
        updateZoom(zoom - ZOOM_STEP);
        return;
      }

      if (e.key === '0' || ((e.metaKey || e.ctrlKey) && e.key === '0')) {
        e.preventDefault();
        resetView();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRotatePage(currentPage.pageNumber);
        return;
      }

      // Page navigation shortcuts that always work
      if (e.key === '[' || e.key === 'PageUp') {
        if (activeIndex > 0) {
          e.preventDefault();
          onNavigate(activeIndex - 1);
        }
        return;
      }
      if (e.key === ']' || e.key === 'PageDown') {
        if (activeIndex < pages.length - 1) {
          e.preventDefault();
          onNavigate(activeIndex + 1);
        }
        return;
      }

      // Arrow keys: Pan when zoomed in, otherwise switch pages
      if (zoom > 1) {
        const step = e.shiftKey ? 120 : 56;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPan((p) => ({ ...p, x: p.x + step }));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setPan((p) => ({ ...p, x: p.x - step }));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPan((p) => ({ ...p, y: p.y + step }));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPan((p) => ({ ...p, y: p.y - step }));
        }
      } else {
        if (e.key === 'ArrowLeft' && activeIndex > 0) {
          e.preventDefault();
          onNavigate(activeIndex - 1);
        } else if (e.key === 'ArrowRight' && activeIndex < pages.length - 1) {
          e.preventDefault();
          onNavigate(activeIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, currentPage, pages.length, zoom, onClose, onNavigate, onRotatePage, updateZoom, resetView]);

  // Wheel / Trackpad pinch-to-zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch gesture on trackpad or Ctrl+Scroll
      const delta = -e.deltaY * 0.01;
      updateZoom(zoom + delta);
    } else if (zoom > 1) {
      // Natural two-finger pan when zoomed in
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    } else {
      // Standard mouse wheel zooms smoothly
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      updateZoom(zoom + delta);
    }
  };

  // Pointer drag for panning (when zoomed) or swipe navigation (when at 100%)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (zoom > 1) {
      setIsPanning(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    } else {
      swipeStartRef.current = { x: e.clientX, time: Date.now() };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      dragStartRef.current = null;
      return;
    }

    if (swipeStartRef.current && activeIndex !== null) {
      const dx = e.clientX - swipeStartRef.current.x;
      const dt = Date.now() - swipeStartRef.current.time;
      swipeStartRef.current = null;

      if (dt < 500 && Math.abs(dx) > 65) {
        if (dx < 0 && activeIndex < pages.length - 1) {
          onNavigate(activeIndex + 1);
        } else if (dx > 0 && activeIndex > 0) {
          onNavigate(activeIndex - 1);
        }
      }
    }
  };

  const zoomPercent = Math.round(zoom * 100);
  const sliderFill = ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

  return (
    <AnimatePresence>
      {isOpen && currentPage && activeIndex !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-2xl text-white select-none"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[15px] font-semibold truncate">
                Page {currentPage.pageNumber} of {pages.length}
              </span>
              <span className="text-xs text-white/55 tabular-nums hidden sm:inline">
                {currentPage.width} × {currentPage.height} pt
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onToggleSelect(currentPage.pageNumber)}
                className={`min-h-[40px] px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  currentPage.selected
                    ? 'bg-[#0A84FF] text-white'
                    : 'bg-white/12 text-white/90 hover:bg-white/20'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{currentPage.selected ? 'Selected' : 'Select'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/12 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Zoom & Pan Stage */}
          <div
            ref={stageRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => (zoom > 1 ? resetView() : updateZoom(2))}
            className={`relative flex-1 flex items-center justify-center overflow-hidden px-4 py-6 touch-none lightbox-dot-canvas ${
              zoom > 1
                ? isPanning
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
          >
            {activeIndex > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onNavigate(activeIndex - 1)}
                aria-label="Previous page"
                className="hidden sm:flex absolute left-5 z-20 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/12 hover:bg-white/22 backdrop-blur-md transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transition: isPanning
                  ? 'none'
                  : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="relative max-h-full max-w-full flex items-center justify-center will-change-transform"
            >
              <img
                src={currentPage.thumbnailUrl}
                alt={`Page ${currentPage.pageNumber} preview`}
                draggable={false}
                style={{ transform: `rotate(${currentPage.rotation}deg)` }}
                className="max-h-[68vh] max-w-[88vw] sm:max-w-[75vw] object-contain rounded-[14px] shadow-2xl transition-transform duration-300 pointer-events-none"
              />
            </div>

            {activeIndex < pages.length - 1 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onNavigate(activeIndex + 1)}
                aria-label="Next page"
                className="hidden sm:flex absolute right-5 z-20 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/12 hover:bg-white/22 backdrop-blur-md transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Zoom Slider & Action Toolbar */}
          <div className="px-4 py-3.5 pb-safe border-t border-white/10 bg-black/60 backdrop-blur-xl shrink-0">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Zoom Slider Controls */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => updateZoom(zoom - ZOOM_STEP)}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Zoom out"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/12 hover:bg-white/20 disabled:opacity-35 transition-colors shrink-0"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2.5 flex-1 sm:flex-initial sm:w-36 md:w-44">
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => updateZoom(parseFloat(e.target.value))}
                    aria-label="Zoom level"
                    className="ios-slider w-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #0A84FF 0%, #0A84FF ${sliderFill}%, rgba(255,255,255,0.22) ${sliderFill}%, rgba(255,255,255,0.22) 100%)`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => updateZoom(zoom + ZOOM_STEP)}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Zoom in"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/12 hover:bg-white/20 disabled:opacity-35 transition-colors shrink-0"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={resetView}
                  title="Reset zoom and pan (Shortcut: 0)"
                  className="min-h-[36px] min-w-[54px] px-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold tabular-nums flex items-center justify-center gap-1 transition-colors shrink-0"
                >
                  <span>{zoomPercent}%</span>
                  {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
                    <RotateCcw className="w-3 h-3 opacity-75" />
                  )}
                </button>
              </div>

              {/* Rotate & Save Actions */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onRotatePage(currentPage.pageNumber)}
                  title="Rotate 90° (Shortcut: R)"
                  className="min-h-[40px] px-4 rounded-full bg-white/12 hover:bg-white/20 text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownloadSingle(currentPage)}
                  className="min-h-[40px] px-5 rounded-full bg-[#0A84FF] hover:bg-[#1E8FFF] text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Save Image</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
