'use client';

import { useRef, useState, useCallback } from 'react';
import { uploadsApi } from '@/lib/api';

export interface FileAttachment {
  url: string;
  name: string;
}

interface Props {
  value?: FileAttachment | null;
  onChange: (file: FileAttachment | null) => void;
  token: string;
}

export default function FileUpload({ value, onChange, token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const upload = useCallback(async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const res = await uploadsApi.file(token, file);
      onChange({ url: res.url, name: res.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setUploading(false);
    }
  }, [token, onChange]);

  const onFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (file) upload(file);
  }, [upload]);

  if (value) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', maxWidth: '100%' }}>
        <a
          href={value.url}
          target="_blank"
          rel="noopener noreferrer"
          className="answer-option"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem', textDecoration: 'none',
            color: 'var(--color-accent)', maxWidth: '100%',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</span>
        </a>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Удалить файл"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            border: 'none', cursor: 'pointer',
            background: 'var(--color-danger)', color: '#fff',
            fontSize: 14, lineHeight: 1, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) onFiles(e.dataTransfer.files);
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '1rem 1.25rem',
          minHeight: 64,
          border: `1.5px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
          borderRadius: 8,
          background: dragOver ? 'var(--color-accent-light)' : 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
          cursor: uploading ? 'wait' : 'pointer',
          fontSize: '0.8125rem',
          transition: 'border-color 0.12s, background 0.12s',
          textAlign: 'center',
        }}
      >
        {uploading ? (
          <>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            Загрузка…
          </>
        ) : (
          <>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Перетащите файл или нажмите для выбора
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt,.doc,.docx,.pdf,.rtf,.odt,.ods,.zip,.json,.xml,.pptx,.ppt"
        style={{ display: 'none' }}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      {error && (
        <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-danger)' }}>{error}</p>
      )}
    </div>
  );
}
