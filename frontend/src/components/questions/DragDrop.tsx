'use client';

import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: {
    text: string;
    items: string[];
    slots: string[];
  };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function DragDrop({ content, value, onChange, disabled }: Props) {
  const placed = (value as Record<string, string>) || {};

  const handleSelect = (slotIdx: string, itemIdx: string) => {
    if (disabled) return;
    const newPlaced = { ...placed, [slotIdx]: itemIdx };
    onChange(newPlaced);
  };

  const getAvailableItems = (currentSlot: string) => {
    const usedItems = Object.entries(placed)
      .filter(([slot]) => slot !== currentSlot)
      .map(([, item]) => item);
    return content.items.map((item, i) => ({
      item,
      index: String(i),
      used: usedItems.includes(String(i)),
    }));
  };

  return (
    <div>
      <div className="text-gray-900 font-medium mb-4 leading-relaxed"><HtmlContent html={content.text} /></div>
      <div className="space-y-3">
        {content.slots.map((slot, si) => {
          const slotIdx = String(si);
          const selectedItem = placed[slotIdx];
          return (
            <div key={si} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 min-w-[120px]">{slot}</span>
              <select
                value={selectedItem || ''}
                onChange={(e) => handleSelect(slotIdx, e.target.value)}
                disabled={disabled}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">---</option>
                {getAvailableItems(slotIdx).map(({ item, index, used }) => (
                  <option key={index} value={index} disabled={used}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
