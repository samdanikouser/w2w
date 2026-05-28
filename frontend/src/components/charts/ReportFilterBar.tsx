import { useState } from 'react';

export interface ReportFilter {
  mode: 'all' | 'month' | 'year' | 'range';
  month: string;
  year: string;
  from: string;
  to: string;
}

export const DEFAULT_FILTER: ReportFilter = {
  mode: 'all', month: '', year: '', from: '', to: '',
};

/** Apply filter to a dated item — returns true if item should be included */
export function matchesFilter(dateStr: string | undefined, f: ReportFilter): boolean {
  if (!f || f.mode === 'all') return true;
  if (!dateStr) return false;
  if (f.mode === 'month') return dateStr.slice(0, 7) === f.month;
  if (f.mode === 'year') return dateStr.slice(0, 4) === f.year;
  if (f.mode === 'range') return dateStr >= f.from && dateStr <= f.to;
  return true;
}

interface Props {
  filter: ReportFilter;
  onChange: (f: ReportFilter) => void;
  years?: string[];
}

export function ReportFilterBar({ filter, onChange, years = [] }: Props) {
  const [draft, setDraft] = useState<ReportFilter>(filter);

  const apply = () => onChange({ ...draft });
  const clear = () => {
    const f = { ...DEFAULT_FILTER };
    setDraft(f);
    onChange(f);
  };

  const isFiltered = filter.mode !== 'all';

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'var(--color-text3)', display: 'block',
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  return (
    <div
      className="no-print"
      style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap',
        background: 'var(--color-surface3)', borderRadius: 10,
        padding: '10px 14px', marginBottom: 14,
      }}
    >
      {/* Period selector */}
      <div>
        <label style={labelStyle}>Period</label>
        <select
          className="fc"
          style={{ width: 130, fontSize: 11 }}
          value={draft.mode}
          onChange={(e) => setDraft({ ...draft, mode: e.target.value as ReportFilter['mode'] })}
        >
          <option value="all">All time</option>
          <option value="month">Specific month</option>
          <option value="year">By year</option>
          <option value="range">Date range</option>
        </select>
      </div>

      {/* Month input */}
      {draft.mode === 'month' && (
        <div>
          <label style={labelStyle}>Month</label>
          <input
            className="fc" type="month" style={{ fontSize: 11 }}
            value={draft.month}
            onChange={(e) => setDraft({ ...draft, month: e.target.value })}
          />
        </div>
      )}

      {/* Year input */}
      {draft.mode === 'year' && (
        <div>
          <label style={labelStyle}>Year</label>
          <select
            className="fc" style={{ fontSize: 11, width: 100 }}
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
          >
            <option value="">Select</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* Date range inputs */}
      {draft.mode === 'range' && (
        <>
          <div>
            <label style={labelStyle}>From</label>
            <input
              className="fc" type="date" style={{ fontSize: 11 }}
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input
              className="fc" type="date" style={{ fontSize: 11 }}
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </div>
        </>
      )}

      {/* Apply + Clear */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
        <button className="btn btn-primary btn-sm" onClick={apply}>Apply Filter</button>
        {isFiltered && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
        {isFiltered && (
          <span style={{
            fontSize: 10, color: 'var(--color-w2w)', fontWeight: 700,
            background: 'var(--color-w2w-light)', padding: '3px 8px', borderRadius: 5,
          }}>
            📅 {filter.mode === 'month' ? filter.month :
                 filter.mode === 'year' ? filter.year :
                 `${filter.from} → ${filter.to}`}
          </span>
        )}
      </div>
    </div>
  );
}
