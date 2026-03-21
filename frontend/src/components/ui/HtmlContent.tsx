'use client';

interface Props {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function HtmlContent({ html, className, style }: Props) {
  // If it's plain text (no HTML tags), render as-is
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) {
    return <span className={className} style={style}>{html}</span>;
  }

  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
