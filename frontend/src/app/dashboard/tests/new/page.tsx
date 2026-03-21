'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function NewTestPage() {
  const { token, role, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(5);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [settings, setSettings] = useState({
    shuffle_questions: false,
    shuffle_answers: false,
    show_answer: false,
    show_correct_answers: false,
    show_score: true,
    max_attempts: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);
  if (!mounted || authLoading) return null;

  if (!token || role !== 'teacher') {
    router.push('/login');
    return null;
  }

  function updateSetting(key: string, value: boolean | number) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await testsApi.create(token!, {
        title: title.trim(),
        grade,
        topic: topic.trim() || undefined,
        description: description.trim() || undefined,
        settings,
        is_published: isPublished,
      }) as { id: number };
      router.push(`/dashboard/tests/${res.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать тест');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '40rem', margin: '0 auto', padding: '1.5rem 1rem 2.5rem' }}>
      {/* Back */}
      <button type="button" onClick={() => router.push('/dashboard')} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Мои тесты
      </button>

      <h1 className="t-display" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)', marginBottom: '1.5rem' }}>
        Новый тест
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 className="t-subtitle" style={{ marginBottom: '1rem' }}>Основная информация</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Title */}
            <div>
              <label className="label" htmlFor="testTitle">Название *</label>
              <input
                id="testTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Системы счисления"
                className="input"
                required
                autoFocus
              />
            </div>

            {/* Grade */}
            <div>
              <label className="label" htmlFor="testGrade">Класс *</label>
              <select
                id="testGrade"
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="input"
                style={{ width: 'auto', paddingRight: '2rem' }}
              >
                {[5, 6, 7, 8, 9, 10, 11].map(g => (
                  <option key={g} value={g}>{g} класс</option>
                ))}
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="label" htmlFor="testTopic">Тема</label>
              <input
                id="testTopic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Необязательно"
                className="input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="label" htmlFor="testDesc">Описание</label>
              <textarea
                id="testDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Необязательно"
                className="input"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 className="t-subtitle" style={{ marginBottom: '1rem' }}>Настройки</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label" style={{ minWidth: '10rem', margin: 0 }}>Макс. попыток</label>
              <input
                type="number"
                className="input"
                value={settings.max_attempts}
                onChange={(e) => updateSetting('max_attempts', Math.max(1, Number(e.target.value)))}
                min={1}
                style={{ width: '5rem' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={settings.shuffle_questions}
                onChange={(e) => updateSetting('shuffle_questions', e.target.checked)}
              />
              Перемешивать вопросы
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={settings.shuffle_answers}
                onChange={(e) => updateSetting('shuffle_answers', e.target.checked)}
              />
              Перемешивать ответы
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={settings.show_answer}
                onChange={(e) => updateSetting('show_answer', e.target.checked)}
              />
              Показывать ответ после ответа
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={settings.show_correct_answers}
                onChange={(e) => updateSetting('show_correct_answers', e.target.checked)}
              />
              Показывать правильные ответы
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={settings.show_score}
                onChange={(e) => updateSetting('show_score', e.target.checked)}
              />
              Показывать итоговый балл
            </label>
          </div>
        </div>

        {/* Published */}
        <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Опубликовать тест сразу
          </label>
          <p className="t-caption" style={{ marginTop: '0.375rem', marginLeft: '1.5rem' }}>
            Неопубликованные тесты видны только вам
          </p>
        </div>

        {error && (
          <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              Создание...
            </span>
          ) : 'Создать тест'}
        </button>
      </form>
    </div>
  );
}
