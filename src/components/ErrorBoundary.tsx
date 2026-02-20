import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 font-arabic" dir="rtl">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">حدث خطأ غير متوقع</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              نعتذر عن هذا الخطأ. يمكنك إعادة المحاولة أو تحديث الصفحة.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} className="rounded-xl">
                <RefreshCw className="w-4 h-4 ml-2" />
                إعادة المحاولة
              </Button>
              <Button variant="outline" onClick={this.handleReload} className="rounded-xl">
                تحديث الصفحة
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left text-xs text-muted-foreground bg-muted rounded-xl p-4">
                <summary className="cursor-pointer font-medium mb-2">تفاصيل الخطأ</summary>
                <pre className="whitespace-pre-wrap break-words">{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
