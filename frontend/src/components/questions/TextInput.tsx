'use client';

import HtmlContent from '@/components/ui/HtmlContent';

interface Props {
  content: { text: string; placeholder?: string; image?: string };
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export default function TextInput({ content, value, onChange, disabled }: Props) {
  return (
    <div>
      <div className="text-gray-900 font-medium mb-4 leading-relaxed"><HtmlContent html={content.text} /></div>
      {content.image && (
        <img src={content.image} alt="" className="mb-4 max-w-full rounded-lg border" />
      )}
      <div className="relative">
        <label className="block text-sm text-gray-500 mb-1.5">Ответ:</label>
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-900 disabled:opacity-60"
          placeholder={content.placeholder || 'Введите ответ'}
        />
      </div>
    </div>
  );
}
