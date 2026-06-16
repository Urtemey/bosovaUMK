'use client';

export interface FileAttachment {
  url: string;
  name: string;
}

interface Props {
  file?: FileAttachment | null;
}

/** Ссылка на скачивание файла-вложения к условию задачи. */
export default function AttachedFile({ file }: Props) {
  if (!file || !file.url) return null;
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="answer-option"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1rem', padding: '0.5rem 0.75rem',
        textDecoration: 'none', color: 'var(--color-accent)',
        fontWeight: 500, maxWidth: '100%',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name || 'Файл'}</span>
    </a>
  );
}
