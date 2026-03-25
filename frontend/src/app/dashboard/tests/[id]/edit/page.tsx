'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { testsApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import dynamic from 'next/dynamic';
import SingleChoice from '@/components/questions/SingleChoice';
import MultipleChoice from '@/components/questions/MultipleChoice';
import TextInput from '@/components/questions/TextInput';
import Matching from '@/components/questions/Matching';
import DragDrop from '@/components/questions/DragDrop';
import SelectFromList from '@/components/questions/SelectFromList';
import Ordering from '@/components/questions/Ordering';
import CodeEditor from '@/components/questions/CodeEditor';

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), { ssr: false });

/* ─── Types ─────────────────────────────────────────────────── */

interface Question {
  id: number;
  order: number;
  question_type: string;
  content: Record<string, unknown>;
  correct_answer: unknown;
  points: number;
}

interface Test {
  id: number;
  title: string;
  grade: number;
  topic: string;
  description: string;
  question_count: number;
  questions: Question[];
  settings: Record<string, unknown>;
  is_published: boolean;
}

type QuestionType = 'single_choice' | 'multiple_choice' | 'text_input' | 'matching' | 'drag_drop' | 'select_list' | 'ordering' | 'code';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: 'Одиночный выбор',
  multiple_choice: 'Множественный выбор',
  text_input: 'Ввод ответа',
  matching: 'Соответствие',
  drag_drop: 'Перетаскивание',
  select_list: 'Выбор из списка',
  ordering: 'Упорядочивание',
  code: 'Код (программирование)',
};

const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multiple_choice', 'text_input', 'matching', 'drag_drop', 'select_list', 'ordering', 'code'];

/* ─── Question Constructor ──────────────────────────────────── */

interface QuestionFormData {
  question_type: QuestionType;
  text: string;
  points: number;
  // single_choice / multiple_choice
  options: string[];
  correctSingle: number;
  correctMultiple: boolean[];
  // text_input
  acceptedAnswers: string[];
  // matching
  leftItems: string[];
  rightItems: string[];
  // drag_drop
  dragItems: string[];
  dragSlots: string[];
  dragCorrect: Record<string, string>; // slot_idx -> item_idx
  // select_list
  selectRows: string[];
  selectOptions: string[];
  selectCorrect: Record<string, string>; // row_idx -> option_idx
  // ordering
  orderItems: string[];
  // code
  codeLanguage: string;
  codeStarterCode: string;
  codeTestCases: { input: string; expected_output: string }[];
}

function emptyFormData(type: QuestionType): QuestionFormData {
  return {
    question_type: type,
    text: '',
    points: 1,
    options: ['', ''],
    correctSingle: 0,
    correctMultiple: [false, false],
    acceptedAnswers: [''],
    leftItems: ['', ''],
    rightItems: ['', ''],
    dragItems: ['', ''],
    dragSlots: ['', ''],
    dragCorrect: { '0': '0', '1': '1' },
    selectRows: ['', ''],
    selectOptions: ['', ''],
    selectCorrect: { '0': '0', '1': '0' },
    orderItems: ['', '', ''],
    codeLanguage: 'python',
    codeStarterCode: '',
    codeTestCases: [{ input: '', expected_output: '' }],
  };
}

function formDataFromQuestion(q: Question): QuestionFormData {
  const content = q.content;
  const fd = emptyFormData(q.question_type as QuestionType);
  fd.text = (content.text as string) || '';
  fd.points = q.points;

  switch (q.question_type) {
    case 'single_choice': {
      const opts = (content.options as string[]) || ['', ''];
      fd.options = opts;
      fd.correctSingle = typeof q.correct_answer === 'number' ? q.correct_answer : 0;
      fd.correctMultiple = opts.map(() => false);
      break;
    }
    case 'multiple_choice': {
      const opts = (content.options as string[]) || ['', ''];
      fd.options = opts;
      fd.correctMultiple = opts.map((_, i) =>
        Array.isArray(q.correct_answer) ? (q.correct_answer as number[]).includes(i) : false
      );
      fd.correctSingle = 0;
      break;
    }
    case 'text_input': {
      fd.acceptedAnswers = Array.isArray(q.correct_answer) ? (q.correct_answer as string[]) : [''];
      break;
    }
    case 'matching': {
      fd.leftItems = (content.left as string[]) || ['', ''];
      fd.rightItems = (content.right as string[]) || ['', ''];
      break;
    }
    case 'drag_drop': {
      fd.dragItems = (content.items as string[]) || ['', ''];
      fd.dragSlots = (content.slots as string[]) || ['', ''];
      const ca = q.correct_answer as Record<string, string> | undefined;
      if (ca) fd.dragCorrect = ca;
      break;
    }
    case 'select_list': {
      fd.selectRows = (content.rows as string[]) || ['', ''];
      fd.selectOptions = (content.options as string[]) || ['', ''];
      const ca = q.correct_answer as Record<string, string> | undefined;
      if (ca) fd.selectCorrect = ca;
      break;
    }
    case 'ordering': {
      fd.orderItems = (content.items as string[]) || ['', '', ''];
      break;
    }
    case 'code': {
      fd.codeLanguage = (content.language as string) || 'python';
      fd.codeStarterCode = (content.starter_code as string) || '';
      const ca = q.correct_answer as { test_cases?: { input: string; expected_output: string }[] } | undefined;
      fd.codeTestCases = ca?.test_cases || [{ input: '', expected_output: '' }];
      break;
    }
  }
  return fd;
}

function buildPayload(fd: QuestionFormData): { question_type: string; content: Record<string, unknown>; correct_answer: unknown; points: number } {
  const base = { question_type: fd.question_type, points: fd.points };

  switch (fd.question_type) {
    case 'single_choice':
      return {
        ...base,
        content: { text: fd.text, options: fd.options },
        correct_answer: fd.correctSingle,
      };
    case 'multiple_choice':
      return {
        ...base,
        content: { text: fd.text, options: fd.options },
        correct_answer: fd.correctMultiple.reduce<number[]>((acc, checked, i) => {
          if (checked) acc.push(i);
          return acc;
        }, []),
      };
    case 'text_input':
      return {
        ...base,
        content: { text: fd.text, placeholder: 'Введите ответ' },
        correct_answer: fd.acceptedAnswers.filter(a => a.trim()),
      };
    case 'matching': {
      const correct: Record<string, string> = {};
      fd.leftItems.forEach((_, i) => { correct[String(i)] = String(i); });
      return {
        ...base,
        content: { text: fd.text, left: fd.leftItems, right: fd.rightItems },
        correct_answer: correct,
      };
    }
    case 'drag_drop':
      return {
        ...base,
        content: { text: fd.text, items: fd.dragItems, slots: fd.dragSlots },
        correct_answer: fd.dragCorrect,
      };
    case 'select_list':
      return {
        ...base,
        content: { text: fd.text, rows: fd.selectRows, columns: [], options: fd.selectOptions },
        correct_answer: fd.selectCorrect,
      };
    case 'ordering':
      return {
        ...base,
        content: { text: fd.text, items: fd.orderItems },
        correct_answer: fd.orderItems.map((_, i) => i),
      };
    case 'code':
      return {
        ...base,
        content: {
          text: fd.text,
          language: fd.codeLanguage,
          starter_code: fd.codeStarterCode,
          test_cases: fd.codeTestCases,
        },
        correct_answer: { test_cases: fd.codeTestCases },
      };
  }
}

function QuestionPreview({ fd }: { fd: QuestionFormData }) {
  const builtData = buildPayload(fd);
  if (!builtData) return null;
  const previewProps = { content: builtData.content as never, value: undefined, onChange: () => {}, disabled: true };

  return (
    <div style={{ padding: '1rem', border: '1px dashed var(--color-border-strong)', borderRadius: 8, background: 'var(--color-surface-2)' }}>
      <p className="t-caption" style={{ marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6875rem' }}>
        Предпросмотр (как видит ученик)
      </p>
      {fd.question_type === 'single_choice' && <SingleChoice {...previewProps} />}
      {fd.question_type === 'multiple_choice' && <MultipleChoice {...previewProps} />}
      {fd.question_type === 'text_input' && <TextInput {...previewProps} />}
      {fd.question_type === 'matching' && <Matching {...previewProps} />}
      {fd.question_type === 'drag_drop' && <DragDrop {...previewProps} />}
      {fd.question_type === 'select_list' && <SelectFromList {...previewProps} />}
      {fd.question_type === 'ordering' && <Ordering {...previewProps} />}
      {fd.question_type === 'code' && <CodeEditor {...previewProps} />}
    </div>
  );
}

function QuestionConstructor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: QuestionFormData;
  onSave: (data: QuestionFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [fd, setFd] = useState<QuestionFormData>(initial);
  const [showPreview, setShowPreview] = useState(false);

  function update(patch: Partial<QuestionFormData>) {
    setFd(prev => ({ ...prev, ...patch }));
  }

  function handleTypeChange(type: QuestionType) {
    setFd(prev => ({
      ...emptyFormData(type),
      text: prev.text,
      points: prev.points,
    }));
  }

  /* ── Dynamic list helpers ──────────────────────────────────── */

  function addOption() {
    const newOpts = [...fd.options, ''];
    update({ options: newOpts, correctMultiple: [...fd.correctMultiple, false] });
  }
  function removeOption(i: number) {
    if (fd.options.length <= 2) return;
    const newOpts = fd.options.filter((_, idx) => idx !== i);
    const newCm = fd.correctMultiple.filter((_, idx) => idx !== i);
    const newCs = fd.correctSingle >= newOpts.length ? 0 : (fd.correctSingle > i ? fd.correctSingle - 1 : fd.correctSingle);
    update({ options: newOpts, correctMultiple: newCm, correctSingle: newCs });
  }
  function setOption(i: number, val: string) {
    const newOpts = [...fd.options];
    newOpts[i] = val;
    update({ options: newOpts });
  }

  function addAcceptedAnswer() { update({ acceptedAnswers: [...fd.acceptedAnswers, ''] }); }
  function removeAcceptedAnswer(i: number) {
    if (fd.acceptedAnswers.length <= 1) return;
    update({ acceptedAnswers: fd.acceptedAnswers.filter((_, idx) => idx !== i) });
  }
  function setAcceptedAnswer(i: number, val: string) {
    const arr = [...fd.acceptedAnswers];
    arr[i] = val;
    update({ acceptedAnswers: arr });
  }

  function addLeftItem() { update({ leftItems: [...fd.leftItems, ''], rightItems: [...fd.rightItems, ''] }); }
  function removeMatchingPair(i: number) {
    if (fd.leftItems.length <= 2) return;
    update({ leftItems: fd.leftItems.filter((_, idx) => idx !== i), rightItems: fd.rightItems.filter((_, idx) => idx !== i) });
  }
  function setLeftItem(i: number, val: string) { const arr = [...fd.leftItems]; arr[i] = val; update({ leftItems: arr }); }
  function setRightItem(i: number, val: string) { const arr = [...fd.rightItems]; arr[i] = val; update({ rightItems: arr }); }

  function addDragItem() {
    const newItems = [...fd.dragItems, ''];
    update({ dragItems: newItems });
  }
  function removeDragItem(i: number) {
    if (fd.dragItems.length <= 1) return;
    const newItems = fd.dragItems.filter((_, idx) => idx !== i);
    // Fix correct mapping
    const newCorrect: Record<string, string> = {};
    Object.entries(fd.dragCorrect).forEach(([slotIdx, itemIdx]) => {
      const ii = Number(itemIdx);
      if (ii === i) return;
      newCorrect[slotIdx] = String(ii > i ? ii - 1 : ii);
    });
    update({ dragItems: newItems, dragCorrect: newCorrect });
  }
  function setDragItem(i: number, val: string) { const arr = [...fd.dragItems]; arr[i] = val; update({ dragItems: arr }); }

  function addDragSlot() {
    const newSlots = [...fd.dragSlots, ''];
    const newCorrect = { ...fd.dragCorrect };
    newCorrect[String(newSlots.length - 1)] = '0';
    update({ dragSlots: newSlots, dragCorrect: newCorrect });
  }
  function removeDragSlot(i: number) {
    if (fd.dragSlots.length <= 1) return;
    const newSlots = fd.dragSlots.filter((_, idx) => idx !== i);
    const newCorrect: Record<string, string> = {};
    Object.entries(fd.dragCorrect).forEach(([slotIdx, itemIdx]) => {
      const si = Number(slotIdx);
      if (si === i) return;
      newCorrect[String(si > i ? si - 1 : si)] = itemIdx;
    });
    update({ dragSlots: newSlots, dragCorrect: newCorrect });
  }
  function setDragSlot(i: number, val: string) { const arr = [...fd.dragSlots]; arr[i] = val; update({ dragSlots: arr }); }

  function addSelectRow() {
    const newRows = [...fd.selectRows, ''];
    const newCorrect = { ...fd.selectCorrect, [String(newRows.length - 1)]: '0' };
    update({ selectRows: newRows, selectCorrect: newCorrect });
  }
  function removeSelectRow(i: number) {
    if (fd.selectRows.length <= 1) return;
    const newRows = fd.selectRows.filter((_, idx) => idx !== i);
    const newCorrect: Record<string, string> = {};
    Object.entries(fd.selectCorrect).forEach(([rowIdx, optIdx]) => {
      const ri = Number(rowIdx);
      if (ri === i) return;
      newCorrect[String(ri > i ? ri - 1 : ri)] = optIdx;
    });
    update({ selectRows: newRows, selectCorrect: newCorrect });
  }
  function setSelectRow(i: number, val: string) { const arr = [...fd.selectRows]; arr[i] = val; update({ selectRows: arr }); }

  function addSelectOption() { update({ selectOptions: [...fd.selectOptions, ''] }); }
  function removeSelectOption(i: number) {
    if (fd.selectOptions.length <= 1) return;
    const newOpts = fd.selectOptions.filter((_, idx) => idx !== i);
    // Fix correct mapping
    const newCorrect: Record<string, string> = {};
    Object.entries(fd.selectCorrect).forEach(([rowIdx, optIdx]) => {
      const oi = Number(optIdx);
      if (oi === i) newCorrect[rowIdx] = '0';
      else newCorrect[rowIdx] = String(oi > i ? oi - 1 : oi);
    });
    update({ selectOptions: newOpts, selectCorrect: newCorrect });
  }
  function setSelectOption(i: number, val: string) { const arr = [...fd.selectOptions]; arr[i] = val; update({ selectOptions: arr }); }

  /* ── Render type-specific fields ───────────────────────────── */

  function renderTypeFields() {
    switch (fd.question_type) {
      case 'single_choice':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label">Варианты ответа</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addOption}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fd.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="correctSingle"
                    checked={fd.correctSingle === i}
                    onChange={() => update({ correctSingle: i })}
                    title="Правильный ответ"
                  />
                  <input
                    type="text"
                    className="input"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Вариант ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {fd.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                      title="Удалить вариант"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="t-caption" style={{ marginTop: '0.375rem' }}>Отметьте правильный ответ</p>
          </div>
        );

      case 'multiple_choice':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label">Варианты ответа</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addOption}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fd.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={fd.correctMultiple[i] || false}
                    onChange={(e) => {
                      const cm = [...fd.correctMultiple];
                      cm[i] = e.target.checked;
                      update({ correctMultiple: cm });
                    }}
                    title="Правильный ответ"
                  />
                  <input
                    type="text"
                    className="input"
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Вариант ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {fd.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                      title="Удалить вариант"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="t-caption" style={{ marginTop: '0.375rem' }}>Отметьте все правильные ответы</p>
          </div>
        );

      case 'text_input':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label">Принимаемые ответы</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addAcceptedAnswer}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fd.acceptedAnswers.map((ans, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input"
                    value={ans}
                    onChange={(e) => setAcceptedAnswer(i, e.target.value)}
                    placeholder={`Ответ ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {fd.acceptedAnswers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAcceptedAnswer(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                      title="Удалить"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="t-caption" style={{ marginTop: '0.375rem' }}>Все варианты написания, которые считаются правильными</p>
          </div>
        );

      case 'matching':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label">Пары соответствий</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addLeftItem}>+ Добавить пару</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fd.leftItems.map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input"
                    value={fd.leftItems[i]}
                    onChange={(e) => setLeftItem(i, e.target.value)}
                    placeholder={`Левый ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '1.25rem' }}>&harr;</span>
                  <input
                    type="text"
                    className="input"
                    value={fd.rightItems[i]}
                    onChange={(e) => setRightItem(i, e.target.value)}
                    placeholder={`Правый ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {fd.leftItems.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMatchingPair(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                      title="Удалить пару"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="t-caption" style={{ marginTop: '0.375rem' }}>Ученику элементы справа будут перемешаны. Порядок здесь = правильное соответствие.</p>
          </div>
        );

      case 'drag_drop':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Items */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="label">Элементы для перетаскивания</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addDragItem}>+ Добавить</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fd.dragItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input"
                      value={item}
                      onChange={(e) => setDragItem(i, e.target.value)}
                      placeholder={`Элемент ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                    {fd.dragItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDragItem(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                        title="Удалить"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Slots */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="label">Ячейки (куда перетаскивать)</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addDragSlot}>+ Добавить</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fd.dragSlots.map((slot, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input"
                      value={slot}
                      onChange={(e) => setDragSlot(i, e.target.value)}
                      placeholder={`Ячейка ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="input"
                      value={fd.dragCorrect[String(i)] || '0'}
                      onChange={(e) => {
                        const nc = { ...fd.dragCorrect, [String(i)]: e.target.value };
                        update({ dragCorrect: nc });
                      }}
                      style={{ width: 'auto', paddingRight: '2rem' }}
                      title="Правильный элемент"
                    >
                      {fd.dragItems.map((item, j) => (
                        <option key={j} value={String(j)}>{item || `Элемент ${j + 1}`}</option>
                      ))}
                    </select>
                    {fd.dragSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDragSlot(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                        title="Удалить"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'select_list':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Options */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="label">Варианты для выбора</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addSelectOption}>+ Добавить</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fd.selectOptions.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input"
                      value={opt}
                      onChange={(e) => setSelectOption(i, e.target.value)}
                      placeholder={`Вариант ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                    {fd.selectOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSelectOption(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                        title="Удалить"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="label">Строки (вопросы)</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addSelectRow}>+ Добавить</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {fd.selectRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input"
                      value={row}
                      onChange={(e) => setSelectRow(i, e.target.value)}
                      placeholder={`Строка ${i + 1}`}
                      style={{ flex: 1 }}
                    />
                    <select
                      className="input"
                      value={fd.selectCorrect[String(i)] || '0'}
                      onChange={(e) => {
                        const nc = { ...fd.selectCorrect, [String(i)]: e.target.value };
                        update({ selectCorrect: nc });
                      }}
                      style={{ width: 'auto', paddingRight: '2rem' }}
                      title="Правильный вариант"
                    >
                      {fd.selectOptions.map((opt, j) => (
                        <option key={j} value={String(j)}>{opt || `Вариант ${j + 1}`}</option>
                      ))}
                    </select>
                    {fd.selectRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSelectRow(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                        title="Удалить"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'ordering':
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label">Элементы (в правильном порядке)</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ orderItems: [...fd.orderItems, ''] })}>+ Добавить</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fd.orderItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{i + 1}</span>
                  <input
                    type="text"
                    className="input"
                    value={item}
                    onChange={(e) => {
                      const items = [...fd.orderItems];
                      items[i] = e.target.value;
                      update({ orderItems: items });
                    }}
                    placeholder={`Элемент ${i + 1}`}
                    style={{ flex: 1 }}
                  />
                  {fd.orderItems.length > 2 && (
                    <button
                      type="button"
                      onClick={() => update({ orderItems: fd.orderItems.filter((_, j) => j !== i) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.125rem', padding: '0.25rem', lineHeight: 1 }}
                      title="Удалить"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              Введите элементы в правильном порядке. При прохождении теста они будут перемешаны.
            </p>
          </div>
        );

      case 'code':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Language */}
            <div>
              <label className="label">Язык программирования</label>
              <select
                className="input"
                value={fd.codeLanguage}
                onChange={(e) => update({ codeLanguage: e.target.value })}
                style={{ maxWidth: '14rem' }}
              >
                <option value="python">Python</option>
                <option value="pascal">Pascal</option>
              </select>
            </div>

            {/* Starter code */}
            <div>
              <label className="label">Начальный код (необязательно)</label>
              <textarea
                className="input input-mono"
                value={fd.codeStarterCode}
                onChange={(e) => update({ codeStarterCode: e.target.value })}
                placeholder="# Напишите ваше решение здесь"
                rows={4}
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", fontSize: '0.8125rem' }}
              />
            </div>

            {/* Test cases */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="label" style={{ margin: 0 }}>Тестовые случаи</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => update({ codeTestCases: [...fd.codeTestCases, { input: '', expected_output: '' }] })}
                >
                  + Добавить тест
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {fd.codeTestCases.map((tc, i) => (
                  <div key={i} style={{
                    padding: '0.75rem', borderRadius: 8,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface-2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Тест {i + 1}</span>
                      {fd.codeTestCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => update({ codeTestCases: fd.codeTestCases.filter((_, j) => j !== i) })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.125rem', lineHeight: 1 }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.125rem' }}>Входные данные (stdin)</label>
                        <textarea
                          className="input input-mono"
                          value={tc.input}
                          onChange={(e) => {
                            const cases = [...fd.codeTestCases];
                            cases[i] = { ...cases[i], input: e.target.value };
                            update({ codeTestCases: cases });
                          }}
                          rows={2}
                          placeholder="5&#10;3 7"
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.125rem' }}>Ожидаемый вывод (stdout)</label>
                        <textarea
                          className="input input-mono"
                          value={tc.expected_output}
                          onChange={(e) => {
                            const cases = [...fd.codeTestCases];
                            cases[i] = { ...cases[i], expected_output: e.target.value };
                            update({ codeTestCases: cases });
                          }}
                          rows={2}
                          placeholder="10"
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Type selector */}
        <div>
          <label className="label">Тип вопроса</label>
          <select
            className="input"
            value={fd.question_type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
          >
            {QUESTION_TYPES.map(t => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Question text */}
        <div>
          <label className="label">Текст вопроса</label>
          <RichTextEditor
            value={fd.text}
            onChange={(html) => update({ text: html })}
            placeholder="Введите текст вопроса..."
          />
        </div>

        {/* Points */}
        <div>
          <label className="label">Баллы</label>
          <input
            type="number"
            className="input"
            value={fd.points}
            onChange={(e) => update({ points: Math.max(1, Number(e.target.value)) })}
            min={1}
            style={{ width: '5rem' }}
          />
        </div>

        {/* Type-specific fields */}
        {renderTypeFields()}

        {/* Preview toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showPreview ? 'Скрыть предпросмотр' : 'Предпросмотр'}
          </button>
          {showPreview && fd.text.trim() && <div style={{ marginTop: '0.75rem' }}><QuestionPreview fd={fd} /></div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onSave(fd)}
            disabled={saving || !fd.text.trim()}
          >
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
              </span>
            ) : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Edit Page ────────────────────────────────────────── */

export default function EditTestPage() {
  const { id } = useParams();
  const { token, role, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const testId = Number(id);

  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);

  // Test info editing
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoGrade, setInfoGrade] = useState(5);
  const [infoTopic, setInfoTopic] = useState('');
  const [infoDescription, setInfoDescription] = useState('');
  const [infoPublished, setInfoPublished] = useState(false);
  const [infoSettings, setInfoSettings] = useState<Record<string, unknown>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  // Question editor
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [error, setError] = useState('');

  const loadTest = useCallback(async () => {
    try {
      const data = await testsApi.get(testId) as Test;
      setTest(data);
      setInfoTitle(data.title);
      setInfoGrade(data.grade);
      setInfoTopic(data.topic || '');
      setInfoDescription(data.description || '');
      setInfoPublished(data.is_published);
      setInfoSettings(data.settings || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (authLoading) return;
    if (!token || role !== 'teacher') {
      router.push('/login');
      return;
    }
    loadTest();
  }, [token, role, router, loadTest, authLoading]);

  async function handleSaveInfo() {
    setSavingInfo(true);
    setError('');
    try {
      await testsApi.update(token!, testId, {
        title: infoTitle.trim(),
        grade: infoGrade,
        topic: infoTopic.trim() || undefined,
        description: infoDescription.trim() || undefined,
        is_published: infoPublished,
        settings: infoSettings,
      });
      await loadTest();
      setEditingInfo(false);
      showToast('Тест сохранён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleAddQuestion(fd: QuestionFormData) {
    setSavingQuestion(true);
    setError('');
    try {
      const payload = buildPayload(fd);
      await testsApi.addQuestion(token!, testId, payload);
      await loadTest();
      setAddingQuestion(false);
      showToast('Вопрос добавлен');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить вопрос');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleUpdateQuestion(questionId: number, fd: QuestionFormData) {
    setSavingQuestion(true);
    setError('');
    try {
      const payload = buildPayload(fd);
      await testsApi.updateQuestion(token!, testId, questionId, payload);
      await loadTest();
      setEditingQuestionId(null);
      showToast('Вопрос обновлён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить вопрос');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!confirm('Удалить этот вопрос?')) return;
    setError('');
    try {
      await testsApi.deleteQuestion(token!, testId, questionId);
      await loadTest();
      showToast('Вопрос удалён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить вопрос');
    }
  }

  function updateInfoSetting(key: string, value: boolean | number) {
    setInfoSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ height: 16, width: 80, background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: '1.5rem' }} />
        <div style={{ height: 28, width: '60%', background: 'var(--color-surface-3)', borderRadius: 4, marginBottom: 8 }} />
        <div className="card-lg" style={{ height: 160, background: 'var(--color-surface-3)' }} />
      </div>
    );
  }

  if (!test) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <p className="t-body">Тест не найден</p>
      </div>
    );
  }

  const gradeColor = `var(--color-g${test.grade})`;

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.5rem 1rem 2.5rem' }}>
      {/* Back */}
      <button type="button" onClick={() => router.push('/dashboard')} className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Мои тесты
      </button>

      {/* ── Test info section ──────────────────────────────────── */}
      {!editingInfo ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: gradeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {test.grade} класс
                </span>
                {test.topic && (
                  <>
                    <span className="t-caption" style={{ color: 'var(--color-border-strong)' }}>&middot;</span>
                    <span className="t-caption">{test.topic}</span>
                  </>
                )}
                <span className="t-caption" style={{ color: 'var(--color-border-strong)' }}>&middot;</span>
                <span className="t-caption" style={{ color: test.is_published ? 'var(--color-ok)' : 'var(--color-text-muted)' }}>
                  {test.is_published ? 'Опубликован' : 'Черновик'}
                </span>
              </div>
              <h1 className="t-display" style={{ fontSize: 'clamp(1.375rem, 3vw, 1.75rem)' }}>{test.title}</h1>
              {test.description && <p className="t-body" style={{ marginTop: '0.375rem' }}>{test.description}</p>}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingInfo(true)}>
              Редактировать
            </button>
          </div>
        </div>
      ) : (
        <div className="card-lg" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h2 className="t-subtitle" style={{ marginBottom: '1rem' }}>Редактирование теста</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Название</label>
              <input type="text" className="input" value={infoTitle} onChange={(e) => setInfoTitle(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <label className="label">Класс</label>
                <select className="input" value={infoGrade} onChange={(e) => setInfoGrade(Number(e.target.value))} style={{ width: 'auto', paddingRight: '2rem' }}>
                  {[5, 6, 7, 8, 9, 10, 11].map(g => (
                    <option key={g} value={g}>{g} класс</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Тема</label>
                <input type="text" className="input" value={infoTopic} onChange={(e) => setInfoTopic(e.target.value)} placeholder="Необязательно" />
              </div>
            </div>
            <div>
              <label className="label">Описание</label>
              <textarea className="input" value={infoDescription} onChange={(e) => setInfoDescription(e.target.value)} placeholder="Необязательно" rows={2} style={{ resize: 'vertical' }} />
            </div>

            {/* Settings */}
            <div style={{ padding: '0.875rem 1rem', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <div className="t-label" style={{ marginBottom: '0.75rem' }}>Настройки</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="label" style={{ minWidth: '10rem', margin: 0 }}>Макс. попыток</label>
                  <input
                    type="number"
                    className="input"
                    value={(infoSettings.max_attempts as number) || 1}
                    onChange={(e) => updateInfoSetting('max_attempts', Math.max(1, Number(e.target.value)))}
                    min={1}
                    style={{ width: '5rem' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={!!infoSettings.shuffle_questions} onChange={(e) => updateInfoSetting('shuffle_questions', e.target.checked)} />
                  Перемешивать вопросы
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={!!infoSettings.shuffle_answers} onChange={(e) => updateInfoSetting('shuffle_answers', e.target.checked)} />
                  Перемешивать ответы
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={!!infoSettings.show_answer} onChange={(e) => updateInfoSetting('show_answer', e.target.checked)} />
                  Показывать ответ после ответа
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={!!infoSettings.show_correct_answers} onChange={(e) => updateInfoSetting('show_correct_answers', e.target.checked)} />
                  Показывать правильные ответы
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input type="checkbox" checked={!!infoSettings.show_score} onChange={(e) => updateInfoSetting('show_score', e.target.checked)} />
                  Показывать итоговый балл
                </label>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={infoPublished} onChange={(e) => setInfoPublished(e.target.checked)} />
              Опубликован
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingInfo(false)} disabled={savingInfo}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveInfo} disabled={savingInfo || !infoTitle.trim()}>
                {savingInfo ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                  </span>
                ) : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-danger)' }}>{error}</p>
      )}

      {/* ── Questions list ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 className="t-subtitle">Вопросы ({test.questions.length})</h2>
        {!addingQuestion && editingQuestionId === null && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddingQuestion(true)}>
            + Добавить вопрос
          </button>
        )}
      </div>

      {test.questions.length === 0 && !addingQuestion ? (
        <div
          style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: '12px',
            marginBottom: '1.25rem',
          }}
        >
          <p className="t-subtitle" style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>
            Вопросов пока нет
          </p>
          <p className="t-caption">Добавьте первый вопрос в этот тест</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {test.questions.map((q, i) => (
            editingQuestionId === q.id ? (
              <QuestionConstructor
                key={q.id}
                initial={formDataFromQuestion(q)}
                onSave={(fd) => handleUpdateQuestion(q.id, fd)}
                onCancel={() => setEditingQuestionId(null)}
                saving={savingQuestion}
              />
            ) : (
              <div
                key={q.id}
                className="card-lg"
                style={{ padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
              >
                {/* Number badge */}
                <span
                  style={{
                    width: 28,
                    height: 28,
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>

                {/* Question info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontSize: '0.9375rem',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(q.content.text as string) || 'Вопрос'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="t-caption">{QUESTION_TYPE_LABELS[q.question_type] || q.question_type}</span>
                    <span className="t-caption" style={{ color: 'var(--color-border-strong)' }}>&middot;</span>
                    <span className="t-caption">{q.points} б.</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setEditingQuestionId(q.id); setAddingQuestion(false); }}
                    title="Редактировать"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteQuestion(q.id)}
                    title="Удалить"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Add question constructor */}
      {addingQuestion && (
        <QuestionConstructor
          initial={emptyFormData('single_choice')}
          onSave={handleAddQuestion}
          onCancel={() => setAddingQuestion(false)}
          saving={savingQuestion}
        />
      )}
    </div>
  );
}
