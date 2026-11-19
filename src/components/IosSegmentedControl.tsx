import { motion } from 'motion/react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
}

interface IosSegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  ariaLabel: string;
}

export function IosSegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
}: IosSegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid p-1 rounded-[12px] bg-[#E5E5EA]/90 dark:bg-[#2C2C2E] select-none"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`relative z-10 flex flex-col items-center justify-center min-h-[38px] px-2 py-1.5 rounded-[9px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
              isActive
                ? 'text-black dark:text-white'
                : 'text-[#6C6C70] dark:text-[#98989F] hover:text-black dark:hover:text-white'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                className="absolute inset-0 rounded-[9px] bg-white dark:bg-[#3A3A3C] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]"
              />
            )}
            <span className="relative z-10 leading-tight">{option.label}</span>
            {option.sublabel && (
              <span className="relative z-10 text-[10px] font-normal opacity-70 leading-tight mt-0.5 tabular-nums">
                {option.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
