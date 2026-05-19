'use client';

import { useRef, useState, useCallback } from 'react';
import { uploadsApi } from '@/lib/api';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  token: string;
  compact?: boolean;
}

export default function ImageUpload({ value, onChange, token, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const upload = useCallback(async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadsApi.image(token, file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setUploading(false);
    }
  }, [token, onChange]);

  const onFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) upload(file);
    else if (file) setError('Только изображения');
  }, [upload]);

  if (value) {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            style={{
              maxWidth: compact ? 120 : 280,
              maxHeight: compact ? 90 : 220,
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              display: 'block',
            }}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            title="Удалить изображение"
            style={{
              position: 'absolute', top: -8, right: -8,
              width: 22, height: 22, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: 'var(--color-danger)', color: '#fff',
              fontSize: 14, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            }}
          >
            &times;
          </button>
        </div>
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
          padding: compact ? '0.375rem 0.625rem' : '1rem 1.25rem',
          minHeight: compact ? 'auto' : 80,
          border: `1.5px dashed ${dragOver ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
          borderRadius: 8,
          background: dragOver ? 'var(--color-accent-light)' : 'var(--color-surface-2)',
          color: 'var(--color-text-muted)',
          cursor: uploading ? 'wait' : 'pointer',
          fontSize: compact ? '0.75rem' : '0.8125rem',
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
            <svg width={compact ? 14 : 18} height={compact ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10m18 0l-4.5-4.5L14 13l-3-3-5.5 5.5M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            </svg>
            {compact ? 'Картинка' : 'Перетащите изображение или нажмите для выбора'}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      {error && (
        <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-danger)' }}>{error}</p>
      )}
    </div>
  );
}
