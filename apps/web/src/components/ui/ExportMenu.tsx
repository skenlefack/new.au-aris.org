'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportMenuProps {
  onExportCsv?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  onExportPng?: () => void | Promise<void>;
  onExportZip?: () => void | Promise<void>;
  disabled?: boolean;
}

interface ExportOption {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  handler: () => void | Promise<void>;
}

export function ExportMenu({
  onExportCsv,
  onExportPdf,
  onExportPng,
  onExportZip,
  disabled = false,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const options: ExportOption[] = [];

  if (onExportCsv) {
    options.push({
      key: 'csv',
      label: 'Export as CSV',
      icon: FileSpreadsheet,
      handler: onExportCsv,
    });
  }

  if (onExportPdf) {
    options.push({
      key: 'pdf',
      label: 'Export as PDF',
      icon: FileText,
      handler: onExportPdf,
    });
  }

  if (onExportPng) {
    options.push({
      key: 'png',
      label: 'Export as PNG',
      icon: Image,
      handler: onExportPng,
    });
  }

  if (onExportZip) {
    options.push({
      key: 'zip',
      label: 'Export as ZIP',
      icon: Archive,
      handler: onExportZip,
    });
  }

  // Close menu on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled && !isExporting) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled, isExporting]);

  const handleExport = useCallback(
    async (handler: () => void | Promise<void>) => {
      setIsOpen(false);
      setIsExporting(true);
      try {
        await handler();
      } finally {
        setIsExporting(false);
      }
    },
    [],
  );

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled || isExporting}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          (disabled || isExporting) && 'cursor-not-allowed opacity-50',
        )}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span>Export</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                onClick={() => handleExport(option.handler)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
