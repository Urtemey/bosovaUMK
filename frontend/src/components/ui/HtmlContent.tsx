'use client';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function HtmlContent({ html, className, style }: Props) {
  // Always tag with `html-content` so globals.css can scope rules to
  // editor-authored markup (e.g. inline-sized images) without affecting
  // the question components' own <img> attachments.
  const cls = ['html-content', className].filter(Boolean).join(' ');

  // If it's plain text (no HTML tags), render as-is
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) {
    return <span className={cls} style={style}>{html}</span>;
  }

  return (
    <span
      className={cls}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
