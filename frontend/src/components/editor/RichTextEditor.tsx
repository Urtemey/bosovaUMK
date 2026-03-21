'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Node, mergeAttributes } from '@tiptap/core';
import { useEffect, useState, useCallback } from 'react';
import katex from 'katex';

/* ─── KaTeX inline node ─────────────────────────────────────── */
const KatexInline = Node.create({
  name: 'katexInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      formula: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-katex]' }];
  },

  renderHTML({ HTMLAttributes }) {
    let html = '';
    try {
      html = katex.renderToString(HTMLAttributes.formula || '', { throwOnError: false });
    } catch {
      html = HTMLAttributes.formula || '';
    }
    return ['span', mergeAttributes({ 'data-katex': '', 'data-formula': HTMLAttributes.formula, class: 'katex-inline', contenteditable: 'false' }), ['span', { style: 'display:inline', innerHTML: html }]];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-katex', '');
      dom.setAttribute('data-formula', node.attrs.formula);
      dom.contentEditable = 'false';
      dom.style.cursor = 'pointer';
      dom.style.padding = '0 2px';
      try {
        dom.innerHTML = katex.renderToString(node.attrs.formula || '', { throwOnError: false });
      } catch {
        dom.textContent = node.attrs.formula;
      }
      return { dom };
    };
  },
});

/* ─── Toolbar button ─────────────────────────────────────────── */
function TBtn({ active, onClick, title, children, disabled }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 5, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--color-accent-light)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = 'var(--color-surface-3)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

/* ─── Toolbar ────────────────────────────────────────────────── */
function Toolbar({ editor }: { editor: Editor }) {
  const [showFormula, setShowFormula] = useState(false);
  const [formula, setFormula] = useState('');

  const insertFormula = () => {
    if (!formula.trim()) return;
    editor.chain().focus().insertContent({
      type: 'katexInline',
      attrs: { formula: formula.trim() },
    }).run();
    setFormula('');
    setShowFormula(false);
  };

  const insertImage = () => {
    const url = prompt('URL изображения:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const i = (d: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, padding: '0.375rem 0.5rem',
      borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
      borderRadius: '8px 8px 0 0',
    }}>
      <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирный">
        <span style={{ fontWeight: 800, fontSize: 14 }}>B</span>
      </TBtn>
      <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
        <span style={{ fontWeight: 600, fontSize: 14, fontStyle: 'italic' }}>I</span>
      </TBtn>
      <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Подчёркивание">
        <span style={{ fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}>U</span>
      </TBtn>
      <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Зачёркивание">
        <span style={{ fontWeight: 600, fontSize: 14, textDecoration: 'line-through' }}>S</span>
      </TBtn>

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

      <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Список">
        {i('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01')}
      </TBtn>
      <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерованный список">
        {i('M10 6h11M10 12h11M10 18h11M4 6V2l-1 1M3 10h2l-2 2.5L5 15M3 18h1.5a1.5 1.5 0 010 3H3')}
      </TBtn>

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

      <TBtn onClick={insertTable} title="Таблица">
        {i('M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18')}
      </TBtn>
      {editor.isActive('table') && (
        <>
          <TBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Добавить столбец">
            <span style={{ fontSize: 11, fontWeight: 700 }}>+Col</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Добавить строку">
            <span style={{ fontSize: 11, fontWeight: 700 }}>+Row</span>
          </TBtn>
          <TBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Удалить таблицу">
            {i('M18 6L6 18M6 6l12 12')}
          </TBtn>
        </>
      )}

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

      <TBtn onClick={insertImage} title="Изображение">
        {i('M21 15V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10m18 0l-4.5-4.5L14 13l-3-3-5.5 5.5M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4')}
      </TBtn>

      <TBtn active={showFormula} onClick={() => setShowFormula(!showFormula)} title="Формула (LaTeX)">
        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'serif' }}>∑</span>
      </TBtn>

      {showFormula && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 4 }}>
          <input
            type="text"
            value={formula}
            onChange={e => setFormula(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertFormula(); } }}
            placeholder="A \land B"
            style={{
              width: 160, padding: '0.25rem 0.5rem', fontSize: '0.8125rem',
              border: '1px solid var(--color-border-strong)', borderRadius: 5,
              fontFamily: 'monospace', outline: 'none',
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={insertFormula}
            style={{
              padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600,
              background: 'var(--color-accent)', color: '#fff', border: 'none',
              borderRadius: 5, cursor: 'pointer',
            }}
          >
            Вставить
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Editor component ───────────────────────────────────────── */
interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const handleUpdate = useCallback(({ editor }: { editor: Editor }) => {
    onChange(editor.getHTML());
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: placeholder || 'Введите текст...' }),
      KatexInline,
    ],
    content: value,
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        style: 'min-height:120px;padding:0.875rem 1rem;outline:none;font-size:0.9375rem;line-height:1.6;color:var(--color-text-primary);',
      },
    },
  });

  // Sync external value changes (only if editor content differs)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div style={{
      border: '1px solid var(--color-border-strong)', borderRadius: 8,
      background: 'var(--color-surface)', overflow: 'hidden',
    }}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <style>{`
        .tiptap p { margin: 0.25em 0; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--color-text-muted);
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .tiptap th, .tiptap td {
          border: 1px solid var(--color-border-strong);
          padding: 0.375rem 0.625rem;
          min-width: 60px;
          font-size: 0.875rem;
        }
        .tiptap th { background: var(--color-surface-2); font-weight: 600; }
        .tiptap img { max-width: 100%; border-radius: 6px; margin: 0.5em 0; }
        .tiptap ul, .tiptap ol { padding-left: 1.5em; margin: 0.25em 0; }
        .tiptap .katex { font-size: 1.05em; }
      `}</style>
    </div>
  );
}
