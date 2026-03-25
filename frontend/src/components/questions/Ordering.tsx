'use client';

import { useState } from 'react';
import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: { text: string; items: string[] };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function Ordering({ content, value, onChange, disabled }: Props) {
  // value is the current order as array of indices, e.g. [2, 0, 1, 3]
  const order = (value as number[]) || content.items.map((_, i) => i);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const swap = (fromPos: number, toPos: number) => {
    if (disabled) return;
    const newOrder = [...order];
    const temp = newOrder[fromPos];
    newOrder[fromPos] = newOrder[toPos];
    newOrder[toPos] = temp;
    onChange(newOrder);
  };

  const moveUp = (pos: number) => {
    if (pos > 0) swap(pos, pos - 1);
  };

  const moveDown = (pos: number) => {
    if (pos < order.length - 1) swap(pos, pos + 1);
  };

  const handleDragStart = (pos: number) => {
    if (disabled) return;
    setDragIdx(pos);
  };

  const handleDragOver = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === pos) return;
  };

  const handleDrop = (e: React.DragEvent, pos: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === pos || disabled) return;

    const newOrder = [...order];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(pos, 0, moved);
    onChange(newOrder);
    setDragIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  return (
    <div>
      <div className="text-gray-900 font-medium mb-4 leading-relaxed">
        <HtmlContent html={content.text} />
      </div>
      <p className="text-xs text-gray-400 mb-3">Перетащите элементы или используйте стрелки для упорядочивания</p>
      <div className="space-y-2">
        {order.map((itemIdx, pos) => (
          <div
            key={`${pos}-${itemIdx}`}
            draggable={!disabled}
            onDragStart={() => handleDragStart(pos)}
            onDragOver={(e) => handleDragOver(e, pos)}
            onDrop={(e) => handleDrop(e, pos)}
            onDragEnd={handleDragEnd}
            className={`
              flex items-center gap-2 p-3 rounded-xl border-2 text-sm transition-all
              ${dragIdx === pos
                ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                : 'border-gray-200 bg-white hover:border-gray-300'}
              ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'}
            `}
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">
              {pos + 1}
            </span>
            <span className="flex-1">{content.items[itemIdx]}</span>
            {!disabled && (
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(pos)}
                  disabled={pos === 0}
                  className="w-6 h-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(pos)}
                  disabled={pos === order.length - 1}
                  className="w-6 h-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
