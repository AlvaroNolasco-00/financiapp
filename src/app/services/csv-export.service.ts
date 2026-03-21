import { Injectable } from '@angular/core';

export interface CsvColumnConfig<T> {
  key: keyof T & string;
  header: string;
  format?: (value: any, row: T) => string;
}

export interface CsvExportOptions {
  filename: string;
  includeBom?: boolean;
  separator?: string;
}

export function formatCurrency(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? '');
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? '');
  return num.toFixed(2) + '%';
}

export function formatInteger(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return String(value ?? '');
  return Math.round(num).toString();
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {

  exportTable<T extends Record<string, any>>(
    data: T[],
    columns: CsvColumnConfig<T>[],
    options: CsvExportOptions
  ): void {
    const sep = options.separator ?? ',';
    const csv = this.buildTableCsvString(data, columns, sep);
    this.downloadCsv(csv, options.filename, options.includeBom ?? true);
  }

  exportSummary<T extends Record<string, any>>(
    data: T,
    columns: CsvColumnConfig<T>[],
    options: CsvExportOptions
  ): void {
    const sep = options.separator ?? ',';
    const csv = this.buildSummaryCsvString(data, columns, sep);
    this.downloadCsv(csv, options.filename, options.includeBom ?? true);
  }

  exportMultiSection(
    sections: { title: string; csv: string }[],
    options: CsvExportOptions
  ): void {
    const parts = sections.map(s => `${s.title}\n${s.csv}`);
    const content = parts.join('\n\n');
    this.downloadCsv(content, options.filename, options.includeBom ?? true);
  }

  buildTableCsvString<T extends Record<string, any>>(
    data: T[],
    columns: CsvColumnConfig<T>[],
    separator = ','
  ): string {
    const header = columns.map(c => this.escapeCell(c.header)).join(separator);
    const rows = data.map(row =>
      columns.map(c => {
        const raw = row[c.key];
        const value = c.format ? c.format(raw, row) : String(raw ?? '');
        return this.escapeCell(value);
      }).join(separator)
    );
    return [header, ...rows].join('\n');
  }

  buildSummaryCsvString<T extends Record<string, any>>(
    data: T,
    columns: CsvColumnConfig<T>[],
    separator = ','
  ): string {
    const rows = columns.map(c => {
      const raw = data[c.key];
      const value = c.format ? c.format(raw, data) : String(raw ?? '');
      return `${this.escapeCell(c.header)}${separator}${this.escapeCell(value)}`;
    });
    return rows.join('\n');
  }

  private escapeCell(value: string): string {
    if (/[,"\n\r]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  private downloadCsv(content: string, filename: string, includeBom: boolean): void {
    const bom = includeBom ? '\uFEFF' : '';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
