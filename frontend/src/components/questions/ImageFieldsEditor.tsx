'use client';

import { useRef, useState } from 'react';

export interface ImgField {
  id: string;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
}

interface Props {
  image: string;
  fields: ImgField[];
  answers: Record<string, string[]>; // fieldId -> принимаемые ответы
  onChange: (fields: ImgField[], answers: Record<string, string[]>) => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `c_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Редактор полей ввода поверх изображения. Поля задаются в процентах, можно
// перетаскивать и менять размер (угловой маркер). Для каждого поля — список
// принимаемых ответов.
export default function ImageFieldsEditor({ image, fields, answers, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<
    | { id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: ImgField }
    | null
  >(null);

  const patchField = (id: string, patch: Partial<ImgField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)), answers);
  };

  const addField = () => {
    const id = newId();
    const field: ImgField = { id, x: 38, y: 42, w: 16, h: 7 };
    onChange([...fields, field], { ...answers, [id]: [''] });
    setSelected(id);
  };

  const removeField = (id: string) => {
    const nextAnswers = { ...answers };
    delete nextAnswers[id];
    onChange(fields.filter((f) => f.id !== id), nextAnswers);
    if (selected === id) setSelected(null);
  };

  const setAnswers = (id: string, list: string[]) => {
    onChange(fields, { ...answers, [id]: list });
  };

  const onPointerDown = (
    e: React.PointerEvent,
    field: ImgField,
    mode: 'move' | 'resize',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(field.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: field.id, mode, startX: e.clientX, startY: e.clientY, orig: { ...field } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragRef.current;
    const box = boxRef.current;
    if (!s || !box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dxPct = ((e.clientX - s.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - s.startY) / rect.height) * 100;
    if (s.mode === 'move') {
      patchField(s.id, {
        x: clamp(s.orig.x + dxPct, 0, 100 - s.orig.w),
        y: clamp(s.orig.y + dyPct, 0, 100 - s.orig.h),
      });
    } else {
      patchField(s.id, {
        w: clamp(s.orig.w + dxPct, 3, 100 - s.orig.x),
        h: clamp(s.orig.h + dyPct, 3, 100 - s.orig.y),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
    }
  };

  if (!image) {
    return (
      <p className="t-caption" style={{ color: 'var(--color-text-muted)' }}>
        Сначала загрузите изображение в поле «Изображение к условию» выше — на нём
        можно будет разместить поля ввода.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span className="label" style={{ margin: 0 }}>Поля ввода на изображении</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addField}>+ Добавить поле</button>
      </div>

      <div
        ref={boxRef}
        style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', userSelect: 'none', touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }} draggable={false} />
        {fields.map((f, i) => {
          const isSel = selected === f.id;
          return (
            <div
              key={f.id}
              onPointerDown={(e) => onPointerDown(e, f, 'move')}
              style={{
                position: 'absolute',
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: `${f.w}%`,
                height: `${f.h}%`,
                boxSizing: 'border-box',
                border: `2px solid ${isSel ? 'var(--color-amber)' : 'var(--color-accent)'}`,
                background: isSel ? 'rgba(200,117,51,0.18)' : 'rgba(43,76,126,0.12)',
                borderRadius: 4,
                cursor: 'move',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: isSel ? 'var(--color-amber)' : 'var(--color-accent)',
              }}
            >
              {i + 1}
              <span
                onPointerDown={(e) => onPointerDown(e, f, 'resize')}
                style={{
                  position: 'absolute', right: -6, bottom: -6, width: 12, height: 12,
                  borderRadius: '50%', background: 'var(--color-accent)', border: '2px solid #fff',
                  cursor: 'nwse-resize',
                }}
              />
            </div>
          );
        })}
      </div>

      {fields.length === 0 ? (
        <p className="t-caption" style={{ color: 'var(--color-text-muted)' }}>
          Нажмите «+ Добавить поле» и перетащите рамку на пустую клетку. Для каждого
          поля укажите принимаемые ответы.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {fields.map((f, i) => {
            const list = answers[f.id] && answers[f.id].length ? answers[f.id] : [''];
            return (
              <div
                key={f.id}
                style={{
                  padding: '0.625rem',
                  border: `1px solid ${selected === f.id ? 'var(--color-amber)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  background: 'var(--color-surface-2)',
                }}
                onClick={() => setSelected(f.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Поле {i + 1}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', lineHeight: 1 }}
                    title="Удалить поле"
                  >
                    &times;
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {list.map((ans, ai) => (
                    <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="input"
                        value={ans}
                        onChange={(e) => {
                          const arr = [...list];
                          arr[ai] = e.target.value;
                          setAnswers(f.id, arr);
                        }}
                        placeholder={ai === 0 ? 'Правильный ответ' : 'Ещё допустимый вариант'}
                        style={{ flex: 1 }}
                      />
                      {list.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAnswers(f.id, list.filter((_, j) => j !== ai))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                          title="Удалить вариант"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => setAnswers(f.id, [...list, ''])}
                  >
                    + Вариант ответа
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
