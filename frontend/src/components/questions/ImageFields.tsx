'use client';

import HtmlContent from '@/components/ui/HtmlContent';
import AttachedFile from '@/components/ui/AttachedFile';

interface Field {
  id: string;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
}

interface Props {
  content: { text: string; image?: string; fields?: Field[]; file?: { url: string; name: string } };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

// Изображение с полями ввода поверх него (например, пустые клетки таблицы
// истинности). Координаты полей — в процентах относительно картинки, поэтому
// раскладка сохраняется при любом масштабе.
export default function ImageFields({ content, value, onChange, disabled }: Props) {
  const fields = Array.isArray(content.fields) ? content.fields : [];
  const answers = (value && typeof value === 'object' ? value : {}) as Record<string, string>;

  const set = (id: string, v: string) => {
    if (disabled) return;
    onChange({ ...answers, [id]: v });
  };

  return (
    <div>
      {content.text && (
        <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6 }}>
          <HtmlContent html={content.text} />
        </div>
      )}

      {content.image ? (
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img
            src={content.image}
            alt=""
            style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}
          />
          {fields.map((f, i) => (
            <input
              key={f.id}
              type="text"
              value={answers[f.id] ?? ''}
              onChange={(e) => set(f.id, e.target.value)}
              disabled={disabled}
              title={`Поле ${i + 1}`}
              style={{
                position: 'absolute',
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: `${f.w}%`,
                height: `${f.h}%`,
                boxSizing: 'border-box',
                padding: '0 2px',
                fontSize: '0.8125rem',
                textAlign: 'center',
                border: '2px solid var(--color-accent)',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.92)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
          ))}
        </div>
      ) : (
        <p className="t-caption" style={{ color: 'var(--color-text-muted)' }}>Изображение не задано</p>
      )}

      <AttachedFile file={content.file} />
    </div>
  );
}
