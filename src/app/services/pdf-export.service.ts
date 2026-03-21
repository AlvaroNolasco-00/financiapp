import { Injectable } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Chart } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfSummaryItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface PdfChartImage {
  title: string;
  base64: string;
  width?: number;
  height?: number;
}

export interface PdfTableColumn<T> {
  key: keyof T & string;
  header: string;
  format?: (value: any, row: T) => string;
  align?: 'left' | 'center' | 'right';
}

export interface PdfTableSection {
  title: string;
  data: any[];
  columns: PdfTableColumn<any>[];
}

export interface PdfReportConfig<T extends Record<string, any>> {
  title: string;
  filename: string;
  date?: Date;
  parameters?: PdfSummaryItem[];
  summary?: PdfSummaryItem[];
  charts?: PdfChartImage[];
  table?: {
    title: string;
    data: T[];
    columns: PdfTableColumn<T>[];
  };
  tables?: PdfTableSection[];
  footer?: string;
}

const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Colors
const COLOR_TITLE = [17, 24, 39] as [number, number, number];
const COLOR_BODY = [55, 65, 81] as [number, number, number];
const COLOR_MUTED = [107, 114, 128] as [number, number, number];
const COLOR_DIVIDER = [229, 231, 235] as [number, number, number];
const COLOR_ACCENT = [79, 70, 229] as [number, number, number];
const COLOR_TABLE_HEADER_BG = [243, 244, 246] as [number, number, number];
const COLOR_TABLE_ALT_BG = [249, 250, 251] as [number, number, number];

const WHITE_BG_PLUGIN = {
  id: 'pdfWhiteBg',
  beforeDraw: (c: Chart) => {
    const ctx = c.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }
};

/**
 * Renders the chart onto an offscreen canvas with controlled dimensions and a
 * light theme, then returns the result as a PNG base64 string. Using an
 * offscreen canvas ensures the PDF always gets a predictable aspect ratio
 * regardless of the chart's DOM size.
 */
export function captureChartForPdf(
  directive: BaseChartDirective,
  canvasWidth = 800,
  canvasHeight = 350
): string {
  const chart = (directive as any).chart as Chart | undefined;
  if (!chart) return '';

  // Safe deep-clone of data and options (drops any function-valued properties,
  // which is fine for the investment calculator's plain option objects)
  let data: any = {};
  let options: any = {};
  try { data = JSON.parse(JSON.stringify(chart.data ?? {})); } catch { /* ignore */ }
  try { options = JSON.parse(JSON.stringify(chart.options ?? {})); } catch { /* ignore */ }

  // Apply light theme overrides
  options.responsive = false;
  options.animation = false;
  options.maintainAspectRatio = false;

  if (!options.plugins) options.plugins = {};
  if (!options.plugins.legend) options.plugins.legend = {};
  if (!options.plugins.legend.labels) options.plugins.legend.labels = {};
  options.plugins.legend.labels.color = '#374151';

  // Remove dark tooltip colours
  if (options.plugins.tooltip) {
    delete options.plugins.tooltip.backgroundColor;
    delete options.plugins.tooltip.titleColor;
    delete options.plugins.tooltip.bodyColor;
  }

  const scales = options.scales ?? {};
  for (const key of Object.keys(scales)) {
    const scale = scales[key];
    if (scale?.ticks) scale.ticks.color = '#374151';
    if (scale?.grid) scale.grid.color = 'rgba(0,0,0,0.08)';
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;

  const tempChart = new Chart(offscreen, {
    type: (chart.config as any).type as any,
    data,
    options,
    plugins: [WHITE_BG_PLUGIN],
  });

  const img = tempChart.toBase64Image('image/png', 1.0);
  tempChart.destroy();
  return img;
}

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  exportReport<T extends Record<string, any>>(config: PdfReportConfig<T>): void {
    const doc = this.buildReport(config);
    const filename = config.filename.endsWith('.pdf') ? config.filename : config.filename + '.pdf';
    doc.save(filename);
  }

  buildReport<T extends Record<string, any>>(config: PdfReportConfig<T>): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = MARGIN_TOP;

    y = this.drawHeader(doc, config.title, config.date ?? new Date(), y);
    y += 4;

    if (config.parameters?.length) {
      y = this.drawSectionTitle(doc, 'Parámetros', y);
      y = this.drawKeyValueList(doc, config.parameters, y);
      y += 4;
    }

    if (config.summary?.length) {
      y = this.drawSectionTitle(doc, 'Resumen', y);
      y = this.drawSummaryMetrics(doc, config.summary, y);
      y += 4;
    }

    if (config.charts?.length) {
      for (const chart of config.charts) {
        if (!chart.base64) continue;
        const { w, h } = this.calcChartDimensions(doc, chart);
        const neededSpace = 11 + h + 6; // sectionTitle + chart + padding
        y = this.ensureSpace(doc, y, neededSpace);
        y = this.drawSectionTitle(doc, chart.title, y);
        y = this.drawChartImage(doc, chart, w, h, y);
        y += 4;
      }
    }

    const allTables: PdfTableSection[] = [
      ...(config.table ? [config.table] : []),
      ...(config.tables ?? []),
    ];

    for (const tbl of allTables) {
      y = this.ensureSpace(doc, y, 40);
      y = this.drawSectionTitle(doc, tbl.title, y);
      y = this.drawTable(doc, tbl.data, tbl.columns, y, config.footer);
    }

    this.addPageNumbers(doc, config.footer);
    return doc;
  }

  private drawHeader(doc: jsPDF, title: string, date: Date, y: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_TITLE);
    doc.text(title, MARGIN_LEFT, y + 6);

    const dateStr = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`Generado el ${dateStr}`, MARGIN_LEFT, y + 12);

    // Divider line
    doc.setDrawColor(...COLOR_DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, y + 15, PAGE_WIDTH - MARGIN_RIGHT, y + 15);

    return y + 18;
  }

  private drawSectionTitle(doc: jsPDF, title: string, y: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_ACCENT);
    doc.text(title.toUpperCase(), MARGIN_LEFT, y + 5);

    doc.setDrawColor(...COLOR_DIVIDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, y + 7, PAGE_WIDTH - MARGIN_RIGHT, y + 7);

    return y + 11;
  }

  private drawKeyValueList(doc: jsPDF, items: PdfSummaryItem[], y: number): number {
    const colWidth = CONTENT_WIDTH / 2;
    doc.setFontSize(9);

    let col = 0;
    let rowY = y;

    for (const item of items) {
      const x = MARGIN_LEFT + col * colWidth;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_MUTED);
      doc.text(item.label + ':', x, rowY + 4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_BODY);
      doc.text(item.value, x + colWidth * 0.55, rowY + 4);

      col++;
      if (col === 2) {
        col = 0;
        rowY += 6;
      }
    }

    if (col !== 0) rowY += 6;
    return rowY;
  }

  private drawSummaryMetrics(doc: jsPDF, items: PdfSummaryItem[], y: number): number {
    for (const item of items) {
      if (item.highlight) {
        // Highlight box for main metric
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, 10, 2, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(item.label, MARGIN_LEFT + 4, y + 6.5);
        doc.text(item.value, PAGE_WIDTH - MARGIN_RIGHT - 4, y + 6.5, { align: 'right' });
        y += 13;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(item.label + ':', MARGIN_LEFT + 4, y + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLOR_BODY);
        doc.text(item.value, PAGE_WIDTH - MARGIN_RIGHT - 4, y + 4.5, { align: 'right' });

        // Light divider
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_LEFT + 4, y + 6, PAGE_WIDTH - MARGIN_RIGHT - 4, y + 6);
        y += 7;
      }
    }
    return y;
  }

  private calcChartDimensions(doc: jsPDF, chart: PdfChartImage): { w: number; h: number } {
    const props = doc.getImageProperties(chart.base64);
    const canvasRatio = props.width / props.height;
    const w = Math.min(chart.width ?? CONTENT_WIDTH, CONTENT_WIDTH);
    const h = chart.height ?? (w / canvasRatio);
    return { w, h };
  }

  private drawChartImage(doc: jsPDF, chart: PdfChartImage, w: number, h: number, y: number): number {
    if (!chart.base64) return y;
    const xOffset = MARGIN_LEFT + (CONTENT_WIDTH - w) / 2;
    doc.addImage(chart.base64, 'PNG', xOffset, y, w, h);
    return y + h + 2;
  }

  private drawTable<T extends Record<string, any>>(
    doc: jsPDF,
    data: T[],
    columns: PdfTableColumn<T>[],
    startY: number,
    footer?: string
  ): number {
    const head = [columns.map(c => c.header)];
    const body = data.map(row =>
      columns.map(c => {
        const raw = row[c.key];
        return c.format ? c.format(raw, row) : String(raw ?? '');
      })
    );

    const columnStyles: Record<number, any> = {};
    columns.forEach((col, i) => {
      columnStyles[i] = { halign: col.align ?? 'right' };
    });
    columnStyles[0] = { halign: 'center' };
    if (columns.length > 1) columnStyles[1] = { halign: 'center' };

    autoTable(doc, {
      startY,
      head,
      body,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        textColor: [55, 65, 81],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: COLOR_TABLE_HEADER_BG,
        textColor: COLOR_TITLE,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: COLOR_TABLE_ALT_BG,
      },
      columnStyles,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      tableLineColor: COLOR_DIVIDER,
      tableLineWidth: 0.1,
    });

    return (doc as any).lastAutoTable?.finalY ?? startY;
  }

  private ensureSpace(doc: jsPDF, y: number, needed: number): number {
    const available = PAGE_HEIGHT - y - 15;
    if (available < needed) {
      doc.addPage();
      return MARGIN_TOP;
    }
    return y;
  }

  private addPageNumbers(doc: jsPDF, footerText?: string): void {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);

      const pageStr = `Página ${i} de ${totalPages}`;
      doc.text(pageStr, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 8, { align: 'right' });

      if (footerText) {
        doc.text(footerText, MARGIN_LEFT, PAGE_HEIGHT - 8);
      }

      // Footer line
      doc.setDrawColor(...COLOR_DIVIDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_LEFT, PAGE_HEIGHT - 11, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 11);
    }
  }
}
