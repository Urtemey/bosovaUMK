'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import Link from 'next/link';
import { GRADES, gradeLabel, gradeSections, SECTION_LABELS, SECTION_FULL } from '@/lib/sections';

const IMPORT_EXT = /\.(html?|zip)$/i;

interface FileResult {
  filename: string;
  ok: boolean;
  test_id?: number;
  title?: string;
  imported_count?: number;
  images_uploaded?: number;
  images_failed?: number;
  unsupported?: number;
  error?: string;
}

interface ImportResponse {
  results: FileResult[];
  total_tests: number;
  total_questions: number;
  total_images_uploaded: number;
  manual_images_failed: number;
  s3_error: string | null;
}

export default function ImportPage() {
  const { token, role } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [grade, setGrade] = useState(5);
  const [section, setSection] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResponse | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // webkitdirectory не типизирован в JSX — выставляем атрибут вручную
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  });

  if (!mounted) return null;

  if (role !== 'admin') {
    router.push('/login');
    return null;
  }

  const hasZip = files.some((f) => f.name.toLowerCase().endsWith('.zip'));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError('Выберите хотя бы один файл (.html или .zip)');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      for (const f of files) formData.append('files', f);
      formData.append('grade', String(grade));
      if (section) formData.append('section', section);
      if (topic) formData.append('topic', topic);
      if (files.length === 1 && title) formData.append('title', title);

      if (images.length > 0) {
        const paths: string[] = [];
        for (const img of images) {
          formData.append('images', img);
          paths.push(img.webkitRelativePath || img.name);
        }
        formData.append('image_paths', JSON.stringify(paths));
      }

      const data = (await testsApi.importFiles(token!, formData)) as ImportResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setFiles([]);
    setImages([]);
    setTitle('');
    setTopic('');
  }

  return (
    <div style={{ maxWidth: '40rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <button type="button" onClick={() => router.push('/dashboard')} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        К панели
      </button>

      <h1 className="t-title" style={{ marginBottom: '0.25rem' }}>Импорт тестов</h1>
      <p className="t-caption" style={{ marginBottom: '1.5rem' }}>
        HTML-файлы (формат contenttests) и ZIP-архивы (QTI / DL_RES). Можно выбрать
        несколько сразу — каждый файл станет отдельным тестом-черновиком.
      </p>

      {result ? (
        <div className="card-lg" style={{ padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--color-ok-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="t-subtitle" style={{ marginBottom: '0.25rem' }}>
              Создано тестов: {result.total_tests} · вопросов: {result.total_questions}
            </p>
            {result.total_images_uploaded > 0 && (
              <p className="t-caption">Изображений загружено в S3: {result.total_images_uploaded}</p>
            )}
            {result.s3_error && (
              <p className="t-caption" style={{ color: 'var(--color-danger)', marginTop: '0.25rem' }}>
                {result.s3_error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {result.results.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                  background: r.ok ? 'var(--color-surface-2)' : 'var(--color-danger-bg)',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{r.ok ? '✓' : '✕'}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title || r.filename}
                  </p>
                  <p className="t-caption">
                    {r.ok ? (
                      <>
                        {r.imported_count} вопр.
                        {r.images_uploaded ? ` · ${r.images_uploaded} изобр.` : ''}
                        {r.unsupported ? ` · пропущено ${r.unsupported}` : ''}
                      </>
                    ) : (
                      <span style={{ color: 'var(--color-danger)' }}>{r.error}</span>
                    )}
                  </p>
                </div>
                {r.ok && r.test_id && (
                  <Link href={`/test/${r.test_id}`} className="btn btn-sm btn-secondary">Открыть</Link>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-primary">К панели</Link>
            <button type="button" className="btn btn-secondary" onClick={reset}>Импортировать ещё</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card-lg" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ flex: '0 0 8rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>Класс</label>
              <select className="input" value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSection(''); }}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{gradeLabel(g)}</option>
                ))}
              </select>
            </div>
            {gradeSections(grade).length > 0 && (
              <div style={{ flex: '0 0 10rem' }}>
                <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>Подраздел</label>
                <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">— не выбран —</option>
                  {gradeSections(grade).map((s) => (
                    <option key={s} value={s}>{SECTION_FULL[s] || SECTION_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>Тема (необязательно)</label>
              <input type="text" className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Применится ко всем" />
            </div>
          </div>

          {files.length === 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>Название теста</label>
              <input
                type="text"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={files[0].name.replace(/\.(html?|zip)$/i, '')}
              />
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              Файлы (.html, .zip)
            </label>
            <div
              style={{
                border: '2px dashed var(--color-border)', borderRadius: '0.75rem',
                padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer',
                background: files.length ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-surface)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => document.getElementById('import-files-input')?.click()}
            >
              <input
                id="import-files-input"
                type="file"
                accept=".html,.htm,.zip"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const fs = e.target.files ? Array.from(e.target.files) : [];
                  if (fs.length) {
                    setFiles(fs);
                    if (fs.length === 1 && !title) setTitle(fs[0].name.replace(/\.(html?|zip)$/i, ''));
                  }
                }}
              />
              {files.length ? (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>
                    Выбрано файлов: {files.length}
                  </p>
                  <p className="t-caption" style={{ marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {files.slice(0, 4).map((f) => f.name).join(', ')}{files.length > 4 ? ` и ещё ${files.length - 4}` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>Нажмите для выбора файлов</p>
                  <p className="t-caption">.html, .htm, .zip · можно несколько</p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => folderInputRef.current?.click()}
              >
                Выбрать папку целиком
              </button>
              {files.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setFiles([]); setTitle(''); }}
                >
                  Очистить
                </button>
              )}
            </div>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const all = e.target.files ? Array.from(e.target.files) : [];
                const filtered = all.filter((f) => IMPORT_EXT.test(f.name));
                if (filtered.length) {
                  setFiles(filtered);
                  if (filtered.length === 1 && !title) setTitle(filtered[0].name.replace(IMPORT_EXT, ''));
                } else if (all.length) {
                  setError('В папке нет файлов .html или .zip');
                }
              }}
            />
            {hasZip && (
              <p className="t-caption" style={{ marginTop: '0.375rem', color: 'var(--color-ok)' }}>
                Изображения из ZIP-архивов загрузятся в S3 автоматически.
              </p>
            )}
          </div>

          {/* Manual images — only meaningful for HTML imports */}
          {!hasZip && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
                Изображения для HTML (необязательно)
              </label>
              <div
                style={{
                  border: '2px dashed var(--color-border)', borderRadius: '0.75rem',
                  padding: '1rem', textAlign: 'center', cursor: 'pointer',
                  background: images.length ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-surface)',
                }}
                onClick={() => document.getElementById('images-input')?.click()}
              >
                <input
                  id="images-input"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const fs = e.target.files ? Array.from(e.target.files) : [];
                    if (fs.length) setImages(fs);
                  }}
                />
                {images.length ? (
                  <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>
                    Выбрано изображений: {images.length}
                  </p>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                    Картинки, на которые ссылается HTML (по именам)
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', background: 'var(--color-danger-bg)', borderRadius: '0.5rem' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || files.length === 0} className="btn btn-primary" style={{ width: '100%' }}>
            {loading ? 'Импорт...' : `Импортировать${files.length > 1 ? ` (${files.length})` : ''}`}
          </button>
        </form>
      )}
    </div>
  );
}
