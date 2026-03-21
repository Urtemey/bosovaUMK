'use client';

import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: { text: string; options: string[]; image?: string };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function MultipleChoice({ content, value, onChange, disabled }: Props) {
  const selected = (value as number[]) || [];

  const toggle = (index: number) => {
    if (disabled) return;
    const newSelected = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [...selected, index];
    onChange(newSelected);
  };

  return (
    <div>
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginBottom: '0.25rem', lineHeight: 1.6 }}>
        <HtmlContent html={content.text} />
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Выберите все правильные варианты
      </p>
      {content.image && (
        <img src={content.image} alt="" style={{ marginBottom: '1rem', maxWidth: '100%', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {content.options.map((option, i) => {
          const isSelected = selected.includes(i);
          return (
            <label
              key={i}
              onClick={() => toggle(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '0.75rem',
                border: isSelected ? '2px solid var(--color-accent)' : '1.5px solid var(--color-border)',
                background: isSelected ? 'rgba(37, 99, 235, 0.07)' : 'var(--color-surface)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.background = 'var(--color-surface-2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.background = 'var(--color-surface)';
                }
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '0.375rem',
                  border: isSelected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                  background: isSelected ? 'var(--color-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '0.875rem', color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                {option}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
