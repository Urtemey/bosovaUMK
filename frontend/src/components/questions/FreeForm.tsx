'use client';

import HtmlContent from '@/components/ui/HtmlContent';
import SingleChoice from '@/components/questions/SingleChoice';
import MultipleChoice from '@/components/questions/MultipleChoice';

/* ─── Block types (rendering side) ───────────────────────────── */
interface HtmlBlock {
  type: 'html';
  html: string;
}
interface FieldBlock {
  type: 'field';
  id: string;
  field_type: 'single_choice' | 'multiple_choice' | 'text' | 'number';
  prompt?: string;
  options?: string[];
}
type Block = HtmlBlock | FieldBlock;

interface Props {
  content: { text: string; image?: string; blocks?: Block[] };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function FreeForm({ content, value, onChange, disabled }: Props) {
  const blocks: Block[] = Array.isArray(content.blocks) ? content.blocks : [];
  const answers = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  function setField(fieldId: string, fieldValue: unknown) {
    if (disabled) return;
    onChange({ ...answers, [fieldId]: fieldValue });
  }

  const inlineInputClass =
    'px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900 disabled:opacity-60';

  return (
    <div>
      {/* Lead / title text */}
      {content.text && (
        <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginBottom: '1rem', lineHeight: 1.6 }}>
          <HtmlContent html={content.text} />
        </div>
      )}
      {content.image && (
        <img src={content.image} alt="" style={{ marginBottom: '1rem', maxWidth: '100%', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {blocks.map((block, i) => {
          if (block.type === 'html') {
            return (
              <div key={i} style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                <HtmlContent html={block.html} />
              </div>
            );
          }

          // field block
          const fieldValue = answers[block.id];
          const prompt = block.prompt || '';

          if (block.field_type === 'single_choice') {
            return (
              <div key={block.id}>
                <SingleChoice
                  content={{ text: prompt, options: block.options || [] }}
                  value={fieldValue}
                  onChange={(v) => setField(block.id, v)}
                  disabled={disabled}
                />
              </div>
            );
          }

          if (block.field_type === 'multiple_choice') {
            return (
              <div key={block.id}>
                <MultipleChoice
                  content={{ text: prompt, options: block.options || [] }}
                  value={fieldValue}
                  onChange={(v) => setField(block.id, v)}
                  disabled={disabled}
                />
              </div>
            );
          }

          // text / number — inline label + input
          return (
            <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              {prompt && (
                <span style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
                  <HtmlContent html={prompt} style={{ display: 'inline' }} />
                </span>
              )}
              <input
                type="text"
                inputMode={block.field_type === 'number' ? 'decimal' : 'text'}
                value={(fieldValue as string) ?? ''}
                onChange={(e) => setField(block.id, e.target.value)}
                disabled={disabled}
                className={inlineInputClass}
                style={{ width: block.field_type === 'number' ? '7rem' : '14rem' }}
                placeholder={block.field_type === 'number' ? '0' : 'Ответ'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
