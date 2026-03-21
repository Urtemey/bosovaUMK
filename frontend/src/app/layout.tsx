import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/layout/AuthProvider";
import Header from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "УМК Информатика — Тестирование по информатике",
  description: "Платформа тестирования по информатике (УМК Босова) для 5–11 классов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}>
        <AuthProvider>
          <ToastProvider>
            <Header />
            <main className="main-content">
              {children}
            </main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
