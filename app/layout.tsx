import { DM_Sans, Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler';
import { Providers } from '@/components/providers';
import { ErrorBoundary } from '@/components/error-boundary';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const jakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display' });
const inter = Inter({ subsets: ['latin'], variable: '--font-mono' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-code' });

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'PushSisten - Gestão Inteligente de Atacado',
  description: 'Sistema operacional inteligente para gestão de atacado e lojas de roupas',
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PushSisten',
  },
  openGraph: {
    title: 'PushSisten - Gestão Inteligente de Atacado',
    description: 'Sistema operacional inteligente para gestão de atacado e lojas de roupas',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1E3A5F" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
      </head>
      <body
        className={`${dmSans.variable} ${jakartaSans.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Toaster />
            <ChunkLoadErrorHandler />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
