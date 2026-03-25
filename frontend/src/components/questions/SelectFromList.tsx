'use client';

import HtmlContent from '@/components/ui/HtmlContent';

interface Dropdown {
  options: string[];
  label: string;
}

interface Props {
  content: {
    text: string;
    rows?: string[];
    columns?: string[];
    options?: string[];
    dropdowns?: Dropdown[];
    image?: string;
  };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function SelectFromList({ content, value, onChange, disabled }: Props) {
  const selections = (value as Record<string, string>) || {};

  const handleChange = (key: string, val: string) => {
    if (disabled) return;
    onChange({ ...selections, [key]: val });
  };

  // Dropdowns mode (from HTML importer): each dropdown has its own options
  if (content.dropdowns && content.dropdowns.length > 0) {
    return (
      <div>
        <div style={{ fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
          <HtmlContent html={content.text} />
        </div>
        {content.image && (
          <img src={content.image} alt="" style={{ marginBottom: '1rem', maxWidth: '100%', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {content.dropdowns.map((dd, i) => {
            const key = String(i);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', minWidth: 50 }}>
                  {dd.label}
                </span>
                <select
                  value={selections[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  className="input"
                  style={{ flex: 1, paddingRight: '2rem' }}
                >
                  <option value="">— выберите —</option>
                  {dd.options.map((opt, oi) => (
                    <option key={oi} value={String(oi)}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Simple key-value mode (no table): rows are labels, each has a dropdown
  if (!content.columns || content.columns.length === 0) {
    return (
      <div>
        <div style={{ fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
          <HtmlContent html={content.text} />
        </div>
        {content.image && (
          <img src={content.image} alt="" style={{ marginBottom: '1rem', maxWidth: '100%', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {(content.rows || []).map((row, ri) => {
            const key = String(ri);
            return (
              <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', minWidth: 140 }}>
                  {row}
                </span>
                <select
                  value={selections[key] || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  disabled={disabled}
                  className="input"
                  style={{ flex: 1, paddingRight: '2rem' }}
                >
                  <option value="">— выберите —</option>
                  {(content.options || []).map((opt, oi) => (
                    <option key={oi} value={String(oi)}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Table mode: rows × columns, each cell has a dropdown
  return (
    <div>
      <div style={{ fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
        <HtmlContent html={content.text} />
      </div>
      {content.image && (
        <img src={content.image} alt="" style={{ marginBottom: '1rem', maxWidth: '100%', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="journal-table" style={{ minWidth: '24rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}></th>
              {content.columns!.map((col, ci) => (
                <th key={ci} style={{ textAlign: 'center' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(content.rows || []).map((row, ri) => (
              <tr key={ri}>
                <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{row}</td>
                {content.columns!.map((_, ci) => {
                  const key = `${ri}-${ci}`;
                  return (
                    <td key={ci} style={{ textAlign: 'center' }}>
                      <select
                        value={selections[key] || ''}
                        onChange={(e) => handleChange(key, e.target.value)}
                        disabled={disabled}
                        className="input"
                        style={{ width: 'auto', minWidth: '6rem', padding: '0.375rem 0.5rem', fontSize: '0.875rem' }}
                      >
                        <option value="">—</option>
                        {(content.options || []).map((opt, oi) => (
                          <option key={oi} value={String(oi)}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
