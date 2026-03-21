'use client';

import { useState } from 'react';
import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: { text: string; left: string[]; right: string[] };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function Matching({ content, value, onChange, disabled }: Props) {
  const matches = (value as Record<string, string>) || {};
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  const handleLeftClick = (index: string) => {
    if (disabled) return;
    setSelectedLeft(selectedLeft === index ? null : index);
  };

  const handleRightClick = (index: string) => {
    if (disabled || selectedLeft === null) return;
    const newMatches = { ...matches, [selectedLeft]: index };
    onChange(newMatches);
    setSelectedLeft(null);
  };

  const getMatchedRight = (leftIdx: string): string | null => {
    return matches[leftIdx] || null;
  };

  const isRightUsed = (rightIdx: string): boolean => {
    return Object.values(matches).includes(rightIdx);
  };

  const COLORS = [
    'bg-blue-100 border-blue-400 text-blue-700',
    'bg-emerald-100 border-emerald-400 text-emerald-700',
    'bg-violet-100 border-violet-400 text-violet-700',
    'bg-indigo-100 border-indigo-400 text-indigo-700',
    'bg-rose-100 border-rose-400 text-rose-700',
    'bg-cyan-100 border-cyan-400 text-cyan-700',
  ];

  const getColor = (leftIdx: string) => {
    const idx = Object.keys(matches).indexOf(leftIdx);
    return idx >= 0 ? COLORS[idx % COLORS.length] : '';
  };

  return (
    <div>
      <div className="text-gray-900 font-medium mb-4 leading-relaxed"><HtmlContent html={content.text} /></div>
      <p className="text-xs text-gray-400 mb-4">Нажмите на элемент слева, затем на соответствующий элемент справа</p>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {content.left.map((item, i) => {
            const idx = String(i);
            const matched = getMatchedRight(idx);
            return (
              <button
                key={i}
                onClick={() => handleLeftClick(idx)}
                disabled={disabled}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                  selectedLeft === idx
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                    : matched !== null
                    ? `${getColor(idx)} border-2`
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                } disabled:cursor-not-allowed`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {content.right.map((item, i) => {
            const idx = String(i);
            const usedByLeft = Object.entries(matches).find(([, v]) => v === idx)?.[0];
            return (
              <button
                key={i}
                onClick={() => handleRightClick(idx)}
                disabled={disabled || (isRightUsed(idx) && selectedLeft === null)}
                className={`w-full text-left p-3 rounded-xl border-2 text-sm transition-all ${
                  usedByLeft !== undefined
                    ? `${getColor(usedByLeft)} border-2`
                    : selectedLeft !== null
                    ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 bg-white cursor-pointer'
                    : 'border-gray-200 bg-white'
                } disabled:cursor-not-allowed`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(matches).length > 0 && (
        <button
          onClick={() => { onChange({}); setSelectedLeft(null); }}
          className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Сбросить все связи
        </button>
      )}
    </div>
  );
}
