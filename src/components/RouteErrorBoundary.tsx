import { ReactNode } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

/** Route-scoped error boundary — isolates page crashes from the full app shell. */
export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
