import { motion } from 'motion/react';
import { Download, CheckSquare, Square, RotateCw, Loader2 } from 'lucide-react';
import { IosSegmentedControl } from './IosSegmentedControl';
import type { DownloadMode, ExportScale, ImageFormat } from '../utils/pdfEngine';

interface SettingsPanelProps {
  format: ImageFormat;
  onFormatChange: (format: ImageFormat) => void;
  scale: ExportScale;
  onScaleChange: (scale: ExportScale) => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  downloadMode: DownloadMode;
  onDownloadModeChange: (mode: DownloadMode) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRotateSelected: () => void;
  onExport: () => void;
  isExporting: boolean;
  exportProgress: { completed: number; total: number } | null;
  layoutIdPrefix: string;
}

const FORMAT_OPTIONS: { value: ImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
];

const SCALE_OPTIONS: { value: ExportScale; label: string }[] = [
  { value: 1, label: 'Standard' },
  { value: 2, label: 'Retina' },
  { value: 3, label: 'Ultra HD' },
];

const DOWNLOAD_MODE_OPTIONS: { value: DownloadMode; label: string }[] = [
  { value: 'zip', label: 'ZIP Archive' },
  { value: 'separate', label: 'Separate Files' },
];

export function SettingsPanel({
  format,
  onFormatChange,
  scale,
  onScaleChange,
  quality,
  onQualityChange,
  downloadMode,
  onDownloadModeChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onRotateSelected,
  onExport,
  isExporting,
  exportProgress,
  layoutIdPrefix,
}: SettingsPanelProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const qualityPercent = Math.round(quality * 100);
  const progressPercent =
    exportProgress && exportProgress.total > 0
      ? Math.round((exportProgress.completed / exportProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Output Format Group */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[13px] font-medium text-[#6C6C70] dark:text-[#98989F]">
            Output Format
          </span>
          <span className="text-[12px] text-[#8E8E93]">
            {format === 'png'
              ? 'Lossless clarity'
              : format === 'jpeg'
              ? 'Compact & universal'
              : 'Modern web size'}
          </span>
        </div>
        <IosSegmentedControl
          options={FORMAT_OPTIONS}
          value={format}
          onChange={onFormatChange}
          layoutId={`${layoutIdPrefix}-format`}
          ariaLabel="Image output format"
        />
      </div>

      {/* Resolution Group */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[13px] font-medium text-[#6C6C70] dark:text-[#98989F]">
            Resolution
          </span>
          <span className="text-[12px] text-[#8E8E93] tabular-nums">
            {scale * 72} DPI
          </span>
        </div>
        <IosSegmentedControl
          options={SCALE_OPTIONS}
          value={scale}
          onChange={onScaleChange}
          layoutId={`${layoutIdPrefix}-scale`}
          ariaLabel="Export resolution"
        />
      </div>

      {/* Quality Slider (for JPG and WebP) */}
      {format !== 'png' && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-[#6C6C70] dark:text-[#98989F]">
              Compression Quality
            </span>
            <span className="text-[13px] font-semibold text-black dark:text-white tabular-nums">
              {qualityPercent}%
            </span>
          </div>
          <div className="px-1 py-1">
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.05}
              value={quality}
              onChange={(e) => onQualityChange(parseFloat(e.target.value))}
              aria-label="Compression quality"
              className="ios-slider w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #007AFF 0%, #007AFF ${
                  ((quality - 0.4) / 0.6) * 100
                }%, rgba(120,120,128,0.22) ${((quality - 0.4) / 0.6) * 100}%, rgba(120,120,128,0.22) 100%)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Download Mode Group (when multiple pages selected) */}
      {selectedCount > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-[#6C6C70] dark:text-[#98989F]">
              Download As
            </span>
            <span className="text-[12px] text-[#8E8E93]">
              {downloadMode === 'zip' ? 'Single archive' : 'One by one'}
            </span>
          </div>
          <IosSegmentedControl
            options={DOWNLOAD_MODE_OPTIONS}
            value={downloadMode}
            onChange={onDownloadModeChange}
            layoutId={`${layoutIdPrefix}-download-mode`}
            ariaLabel="Download mode"
          />
        </div>
      )}

      {/* Quick Batch Actions */}
      <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-[12px] bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[13px] font-medium text-black dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            {allSelected ? (
              <>
                <Square className="w-4 h-4 text-[#6C6C70] dark:text-[#98989F]" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
                <span>Select All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRotateSelected}
            disabled={selectedCount === 0}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 rounded-[12px] bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[13px] font-medium text-black dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            <RotateCw className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" />
            <span>Rotate</span>
          </button>
        </div>
      </div>

      {/* Primary Export CTA */}
      <div className="pt-1 space-y-2.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={onExport}
          disabled={selectedCount === 0 || isExporting}
          className="relative w-full min-h-[50px] px-5 rounded-[14px] bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0071EB] dark:hover:bg-[#1E8FFF] disabled:opacity-45 disabled:pointer-events-none text-white text-[15px] font-semibold flex items-center justify-center gap-2.5 shadow-[0_4px_14px_rgba(0,122,255,0.28)] transition-colors whitespace-nowrap"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="tabular-nums">
                Converting {exportProgress?.completed ?? 0}/{exportProgress?.total ?? selectedCount}
              </span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>
                {selectedCount === 0
                  ? 'Select Pages to Export'
                  : selectedCount === 1
                  ? `Export 1 ${format.toUpperCase()} Image`
                  : downloadMode === 'zip'
                  ? `Export ${selectedCount} Images (ZIP)`
                  : `Download ${selectedCount} Separately`}
              </span>
            </>
          )}
        </motion.button>

        {isExporting && (
          <div className="w-full h-1.5 rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E] overflow-hidden">
            <motion.div
              className="h-full bg-[#007AFF] dark:bg-[#0A84FF] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
