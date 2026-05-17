// ── Lightweight CSV export ──
// Use: exportCsv('employees', rows, [{ key: 'firstName', label: 'First Name' }, ...])

type Column<T> = { key: keyof T | string; label: string; map?: (row: T) => string | number | null | undefined };

export function exportCsv<T extends Record<string, any>>(
  filenameStem: string,
  rows: T[],
  columns: Column<T>[],
): void {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s}"`;
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.map ? c.map(row) : (row as any)[c.key as string];
          return escape(raw);
        })
        .join(','),
    )
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filenameStem}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
