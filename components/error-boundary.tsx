'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error Boundary global — captura erros de renderização React sem derrubar
 * a tela inteira. Exibe mensagem amigável com botão de retry.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Algo deu errado</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Ocorreu um erro inesperado nesta seção. Seus dados estão seguros.
          </p>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg max-w-lg overflow-auto mt-2">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
