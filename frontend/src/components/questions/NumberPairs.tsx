'use client';

import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: { text: string; image?: string; num_pairs?: number };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

type Pair = [string, string];

function pairWord(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'пару';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'пары';
  return 'пар';
}

export default function NumberPairs({ content, value, onChange, disabled }: Props) {
  const count = Math.max(1, Number(content.num_pairs) || 2);

  const current: Pair[] = Array.from({ length: count }, (_, i) => {
    const p = Array.isArray(value) ? (value as unknown[])[i] : undefined;
    if (Array.isArray(p)) {
      return [p[0] != null ? String(p[0]) : '', p[1] != null ? String(p[1]) : ''];
    }
    return ['', ''];
  });

  function setCell(rowIdx: number, col: 0 | 1, val: string) {
    const next = current.map((p) => [...p] as Pair);
    next[rowIdx][col] = val;
    onChange(next);
  }

  const inputClass =
    'w-24 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900 text-center disabled:opacity-60';

  return (
    <div>
      <div className="text-gray-900 font-medium mb-4 leading-relaxed"><HtmlContent html={content.text} /></div>
      {content.image && (
        <img src={content.image} alt="" className="mb-4 max-w-full rounded-lg border" />
      )}
      <label className="block text-sm text-gray-500 mb-2">
        Введите {count} {pairWord(count)} чисел:
      </label>
      <div className="flex flex-col gap-2">
        {current.map((pair, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-sm text-gray-400 text-right">{i + 1}.</span>
            <input
              type="text"
              inputMode="text"
              value={pair[0]}
              onChange={(e) => setCell(i, 0, e.target.value)}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
            />
            <span className="text-gray-400 font-semibold">;</span>
            <input
              type="text"
              inputMode="text"
              value={pair[1]}
              onChange={(e) => setCell(i, 1, e.target.value)}
              disabled={disabled}
              className={inputClass}
              placeholder="—"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
