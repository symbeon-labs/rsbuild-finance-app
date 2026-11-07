import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSBUILD OS | Central de Operações",
  description: "Sistema operacional integrado: inteligência financeira, expedição e conciliação corporativa da RSBUILD."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem('rsbuild_theme');
                if (savedTheme === 'dark' || savedTheme === 'sand') {
                  document.documentElement.setAttribute('data-theme', savedTheme);
                } else {
                  document.documentElement.setAttribute('data-theme', 'sand');
                }
              } catch(e) {}
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
