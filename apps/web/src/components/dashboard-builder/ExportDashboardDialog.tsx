'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Download, FileText, Image as ImageIcon, X, Check, CheckSquare,
  Square, Layers, LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { DashboardSection, DashboardWidget } from '@/lib/api/dashboard-hooks';

// ── Types ──────────────────────────────────────────────────────────────

type ExportFormat = 'png' | 'pdf';
type ExportScope = 'full' | 'selected';

export interface ExportDashboardDialogProps {
  open: boolean;
  onClose: () => void;
  dashboardId: string;
  dashboardTitle: string;
  sections: DashboardSection[];
}

// ── Helper: capture element ────────────────────────────────────────────

async function captureElement(el: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    allowTaint: true,
    // Ignore interactive/overlay elements
    ignoreElements: (element) => {
      return element.classList?.contains('export-ignore') || false;
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'dashboard';
}

// ── Component ──────────────────────────────────────────────────────────

export function ExportDashboardDialog({
  open, onClose, dashboardId, dashboardTitle, sections,
}: ExportDashboardDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scope, setScope] = useState<ExportScope>('full');
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [quality, setQuality] = useState<1 | 2 | 3>(2); // 1x, 2x, 3x

  // Flatten all widgets from sections
  const allWidgets = useMemo(() => {
    const widgets: (DashboardWidget & { sectionTitle: string })[] = [];
    for (const sec of sections) {
      for (const w of sec.widgets || []) {
        widgets.push({ ...w, sectionTitle: sec.titleEn || sec.titleFr || 'Section' });
      }
    }
    return widgets;
  }, [sections]);

  // Toggle widget selection
  const toggleWidget = useCallback((id: string) => {
    setSelectedWidgetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedWidgetIds(new Set(allWidgets.map((w) => w.id)));
  }, [allWidgets]);

  const deselectAll = useCallback(() => {
    setSelectedWidgetIds(new Set());
  }, []);

  // Toggle entire section
  const toggleSection = useCallback((section: DashboardSection) => {
    const sectionWidgetIds = (section.widgets || []).map((w) => w.id);
    setSelectedWidgetIds((prev) => {
      const next = new Set(prev);
      const allSelected = sectionWidgetIds.every((id) => next.has(id));
      if (allSelected) {
        sectionWidgetIds.forEach((id) => next.delete(id));
      } else {
        sectionWidgetIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  // ── Export handler ─────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const filename = sanitizeFilename(dashboardTitle);
      const timestamp = new Date().toISOString().slice(0, 10);

      if (scope === 'full') {
        // Export entire dashboard
        const el = document.getElementById('dashboard-content');
        if (!el) { toast.error('Dashboard content not found'); return; }

        const canvas = await captureElement(el, quality);

        if (format === 'png') {
          const link = document.createElement('a');
          link.download = `${filename}_${timestamp}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          toast.success('Dashboard exported as PNG');
        } else {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('l', 'mm', 'a3');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

          // Add header
          pdf.setFontSize(16);
          pdf.setTextColor(31, 78, 121); // #1F4E79
          pdf.text(dashboardTitle, 14, 14);
          pdf.setFontSize(9);
          pdf.setTextColor(128, 128, 128);
          pdf.text(`ARIS 4.0 — Exported ${new Date().toLocaleDateString('en-GB')}`, 14, 20);

          // Add image below header
          const imgTop = 24;
          const availableHeight = pdf.internal.pageSize.getHeight() - imgTop - 5;
          const scaledHeight = Math.min(pdfHeight, availableHeight);
          const scaledWidth = (scaledHeight / pdfHeight) * pdfWidth;
          pdf.addImage(imgData, 'PNG', 7, imgTop, scaledWidth, scaledHeight);

          pdf.save(`${filename}_${timestamp}.pdf`);
          toast.success('Dashboard exported as PDF');
        }
      } else {
        // Export selected widgets
        if (selectedWidgetIds.size === 0) {
          toast.error('Please select at least one widget');
          return;
        }

        if (format === 'png') {
          // For multiple widgets as PNG, create a combined canvas
          const canvases: { canvas: HTMLCanvasElement; title: string }[] = [];

          for (const wid of selectedWidgetIds) {
            const el = document.querySelector(`[data-widget-id="${wid}"]`) as HTMLElement | null;
            if (el) {
              const widget = allWidgets.find((w) => w.id === wid);
              const canvas = await captureElement(el, quality);
              canvases.push({ canvas, title: widget?.title || 'Widget' });
            }
          }

          if (canvases.length === 0) {
            toast.error('Could not capture selected widgets');
            return;
          }

          if (canvases.length === 1) {
            // Single widget → direct PNG download
            const link = document.createElement('a');
            link.download = `${filename}_widget_${timestamp}.png`;
            link.href = canvases[0].canvas.toDataURL('image/png');
            link.click();
          } else {
            // Multiple widgets → stitch vertically with padding
            const padding = 16;
            const titleHeight = 30;
            const totalWidth = Math.max(...canvases.map((c) => c.canvas.width));
            const totalHeight = canvases.reduce((h, c) => h + c.canvas.height + titleHeight + padding, padding);

            const combined = document.createElement('canvas');
            combined.width = totalWidth;
            combined.height = totalHeight;
            const ctx = combined.getContext('2d')!;

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            let y = padding;
            for (const { canvas, title } of canvases) {
              // Title
              ctx.fillStyle = '#1F4E79';
              ctx.font = 'bold 14px sans-serif';
              ctx.fillText(title, padding, y + 16);
              y += titleHeight;

              // Widget image centered
              const x = Math.round((totalWidth - canvas.width) / 2);
              ctx.drawImage(canvas, x, y);
              y += canvas.height + padding;
            }

            const link = document.createElement('a');
            link.download = `${filename}_${selectedWidgetIds.size}widgets_${timestamp}.png`;
            link.href = combined.toDataURL('image/png');
            link.click();
          }
          toast.success(`${selectedWidgetIds.size} widget(s) exported as PNG`);
        } else {
          // PDF with one widget per page (or arranged in grid)
          const pdf = new jsPDF('l', 'mm', 'a3');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfPageHeight = pdf.internal.pageSize.getHeight();
          let firstPage = true;

          // Cover page
          pdf.setFontSize(20);
          pdf.setTextColor(31, 78, 121);
          pdf.text(dashboardTitle, 14, 20);
          pdf.setFontSize(11);
          pdf.setTextColor(128, 128, 128);
          pdf.text(`${selectedWidgetIds.size} widget(s) exported — ${new Date().toLocaleDateString('en-GB')}`, 14, 28);
          pdf.text('ARIS 4.0 — Animal Resources Information System', 14, 34);

          for (const wid of selectedWidgetIds) {
            const el = document.querySelector(`[data-widget-id="${wid}"]`) as HTMLElement | null;
            if (!el) continue;

            const widget = allWidgets.find((w) => w.id === wid);
            const canvas = await captureElement(el, quality);
            const imgData = canvas.toDataURL('image/png');

            pdf.addPage();
            // Widget title
            pdf.setFontSize(14);
            pdf.setTextColor(31, 78, 121);
            pdf.text(widget?.title || 'Widget', 14, 14);
            pdf.setFontSize(8);
            pdf.setTextColor(160, 160, 160);
            pdf.text(`Section: ${widget?.sectionTitle || ''}`, 14, 19);

            // Image
            const imgTop = 24;
            const ratio = canvas.width / canvas.height;
            const maxW = pdfWidth - 28;
            const maxH = pdfPageHeight - imgTop - 10;
            let imgW = maxW;
            let imgH = imgW / ratio;
            if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
            pdf.addImage(imgData, 'PNG', 14, imgTop, imgW, imgH);
          }

          pdf.save(`${filename}_${selectedWidgetIds.size}widgets_${timestamp}.pdf`);
          toast.success(`${selectedWidgetIds.size} widget(s) exported as PDF`);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [scope, format, quality, selectedWidgetIds, dashboardTitle, allWidgets, dashboardId]);

  const handleClose = () => {
    if (isExporting) return;
    onClose();
  };

  if (!open) return null;

  const selectedCount = selectedWidgetIds.size;
  const totalCount = allWidgets.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div className="mx-4 w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F4E79]/10">
              <Download className="h-4 w-4 text-[#1F4E79]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Export Dashboard</h3>
              <p className="text-xs text-gray-400">{dashboardTitle}</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={isExporting} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Format selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Format</label>
            <div className="flex gap-2">
              {([
                { key: 'png' as ExportFormat, icon: ImageIcon, label: 'PNG Image', desc: 'High-res image' },
                { key: 'pdf' as ExportFormat, icon: FileText, label: 'PDF Document', desc: 'Printable document' },
              ]).map((f) => (
                <button key={f.key} onClick={() => setFormat(f.key)}
                  className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    format === f.key
                      ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:bg-[#1F4E79]/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <f.icon className={`h-5 w-5 ${format === f.key ? 'text-[#1F4E79]' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${format === f.key ? 'text-[#1F4E79]' : 'text-gray-600 dark:text-gray-300'}`}>{f.label}</p>
                    <p className="text-[10px] text-gray-400">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scope selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Scope</label>
            <div className="flex gap-2">
              {([
                { key: 'full' as ExportScope, icon: Layers, label: 'Full Dashboard', desc: 'All sections & widgets' },
                { key: 'selected' as ExportScope, icon: LayoutGrid, label: 'Selected Widgets', desc: 'Choose specific widgets' },
              ]).map((s) => (
                <button key={s.key} onClick={() => setScope(s.key)}
                  className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    scope === s.key
                      ? 'border-[#1F4E79] bg-[#1F4E79]/5 dark:bg-[#1F4E79]/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}>
                  <s.icon className={`h-5 w-5 ${scope === s.key ? 'text-[#1F4E79]' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${scope === s.key ? 'text-[#1F4E79]' : 'text-gray-600 dark:text-gray-300'}`}>{s.label}</p>
                    <p className="text-[10px] text-gray-400">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quality selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Quality</label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((q) => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                    quality === q
                      ? 'bg-[#1F4E79] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}>
                  {q}x {q === 1 ? '(Fast)' : q === 2 ? '(Balanced)' : '(High)'}
                </button>
              ))}
            </div>
          </div>

          {/* Widget selector (only when scope = selected) */}
          {scope === 'selected' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Select widgets ({selectedCount}/{totalCount})
                </label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] font-medium text-[#1F4E79] hover:underline">Select all</button>
                  <button onClick={deselectAll} className="text-[10px] font-medium text-gray-400 hover:underline">Deselect all</button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                {sections.map((sec) => {
                  const sectionWidgets = sec.widgets || [];
                  const secSelected = sectionWidgets.filter((w) => selectedWidgetIds.has(w.id)).length;
                  const allSecSelected = secSelected === sectionWidgets.length && sectionWidgets.length > 0;

                  return (
                    <div key={sec.id}>
                      {/* Section header */}
                      <button onClick={() => toggleSection(sec)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        {allSecSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[#1F4E79]" />
                        ) : secSelected > 0 ? (
                          <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-gray-300" />
                        )}
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {sec.titleEn || sec.titleFr || 'Section'}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400">{secSelected}/{sectionWidgets.length}</span>
                      </button>

                      {/* Widget list */}
                      {sectionWidgets.map((w) => (
                        <button key={w.id} onClick={() => toggleWidget(w.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 pl-7 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          {selectedWidgetIds.has(w.id) ? (
                            <Check className="h-3.5 w-3.5 text-[#1F4E79]" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-gray-300" />
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{w.title}</span>
                          <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1">{w.type}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex-shrink-0">
          <p className="text-xs text-gray-400">
            {scope === 'full'
              ? `${totalCount} widgets in ${sections.length} sections`
              : `${selectedCount} widget(s) selected`}
          </p>
          <div className="flex gap-2">
            <button onClick={handleClose} disabled={isExporting}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleExport}
              disabled={isExporting || (scope === 'selected' && selectedCount === 0)}
              className="flex items-center gap-1.5 rounded-lg bg-[#1F4E79] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#163a5c] disabled:opacity-50 transition-colors">
              {isExporting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
