'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import Link from 'next/link';

export default function ImportPage() {
  const { token, role } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(5);
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    testId: number;
    count: number;
    imagesUploaded: number;
    imagesFailed: number;
    imagesError: string | null;
  } | null>(null);

  // Wait for AuthProvider to hydrate from localStorage before checking role
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (role !== 'admin') {
    router.push('/login');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Выберите HTML файл');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name.replace('.html', ''));
      formData.append('grade', String(grade));
      if (topic) formData.append('topic', topic);

      if (images.length > 0) {
        const paths: string[] = [];
        for (const img of images) {
          formData.append('images', img);
          paths.push(img.webkitRelativePath || img.name);
        }
        formData.append('image_paths', JSON.stringify(paths));
      }

      const data = await testsApi.importHtml(token!, formData) as {
        test: { id: number };
        imported_count: number;
        images_uploaded?: number;
        images_failed?: number;
        images_error?: string | null;
      };
      setResult({
        testId: data.test.id,
        count: data.imported_count,
        imagesUploaded: data.images_uploaded ?? 0,
        imagesFailed: data.images_failed ?? 0,
        imagesError: data.images_error ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      {/* Back */}
      <button type="button" onClick={() => router.push('/dashboard')} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        К панели
      </button>

      <h1 className="t-title" style={{ marginBottom: '0.25rem' }}>Импорт теста из HTML</h1>
      <p className="t-caption" style={{ marginBottom: '1.5rem' }}>
        Загрузите HTML файл с тестом в формате contenttests
      </p>

      {result ? (
        <div className="card-lg" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-ok-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="t-subtitle" style={{ marginBottom: '0.375rem' }}>
            Импортировано {result.count} {result.count === 1 ? 'вопрос' : result.count < 5 ? 'вопроса' : 'вопросов'}
          </p>
          <p className="t-caption" style={{ marginBottom: result.imagesUploaded || result.imagesFailed || result.imagesError ? '0.5rem' : '1.25rem' }}>
            Тест создан как черновик. Проверьте вопросы и опубликуйте.
          </p>
          {(result.imagesUploaded > 0 || result.imagesFailed > 0) && (
            <p className="t-caption" style={{ marginBottom: result.imagesError ? '0.5rem' : '1.25rem' }}>
              Изображений загружено: {result.imagesUploaded}
              {result.imagesFailed > 0 && ` · не удалось: ${result.imagesFailed}`}
            </p>
          )}
          {result.imagesError && (
            <p className="t-caption" style={{ marginBottom: '1.25rem', color: 'var(--color-danger)' }}>
              Изображения не загружены: {result.imagesError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href={`/test/${result.testId}`} className="btn btn-primary">
              Открыть тест
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setResult(null);
                setFile(null);
                setImages([]);
                setTitle('');
                setTopic('');
              }}
            >
              Импортировать ещё
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card-lg" style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              Название теста
            </label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Информация вокруг нас"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ flex: '0 0 8rem' }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
                Класс
              </label>
              <select
                className="input"
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
              >
                {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>{g} класс</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
                Тема (необязательно)
              </label>
              <input
                type="text"
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Тема теста"
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              HTML файл
            </label>
            <div
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1.5rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: file ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-surface)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => document.getElementById('html-file-input')?.click()}
            >
              <input
                id="html-file-input"
                type="file"
                accept=".html,.htm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!title) setTitle(f.name.replace(/\.html?$/i, ''));
                  }
                }}
              />
              {file ? (
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>
                    {file.name}
                  </p>
                  <p className="t-caption" style={{ marginTop: '0.125rem' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
                    Нажмите для выбора файла
                  </p>
                  <p className="t-caption">.html</p>
                </div>
              )}
            </div>
          </div>

          {/* Images referenced by the HTML */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="label" style={{ display: 'block', marginBottom: '0.375rem' }}>
              Изображения к вопросам (необязательно)
            </label>
            <div
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: images.length ? 'rgba(37, 99, 235, 0.04)' : 'var(--color-surface)',
                transition: 'all 0.15s ease',
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
                  Выберите изображения, на которые ссылается HTML
                </p>
              )}
            </div>
            <p className="t-caption" style={{ marginTop: '0.375rem' }}>
              Загрузятся в S3 с сохранением имён, чтобы ссылки в вопросах работали.
            </p>
          </div>

          {error && (
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--color-danger)', padding: '0.5rem 0.75rem', background: 'var(--color-danger-bg)', borderRadius: '0.5rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !file}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? 'Импорт...' : 'Импортировать'}
          </button>
        </form>
      )}
    </div>
  );
}
