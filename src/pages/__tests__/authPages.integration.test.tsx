import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import { StoreBootstrapProvider } from '@/context/StoreBootstrapContext';
import RequestAccess from '@/pages/RequestAccess';
import Login from '@/pages/Login';

vi.mock('@/integrations/supabase/client', () => {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    resend: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  };

  return {
    supabase: {
      auth,
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    },
    getSupabaseClient: vi.fn(),
    resetSupabaseClient: vi.fn(),
  };
});

vi.mock('@/hooks/useRecoveryMonitor', () => ({
  useRecoveryMonitor: () => ({
    mode: 'normal',
    runHealthCheck: vi.fn(),
  }),
}));

vi.mock('@/services/merchantHydration', () => ({
  hydrateMerchantStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/context/SubscriptionContext', () => ({
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSubscription: () => ({
    hasAccess: false,
    isAdmin: false,
    loading: false,
    refresh: vi.fn(),
    subscription: null,
  }),
}));

describe('Auth pages integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders full App on /signup without ErrorBoundary crash', async () => {
    window.history.pushState({}, '', '/signup');
    render(<App />);

    await waitFor(
      () => {
        expect(screen.queryByText('حدث خطأ غير متوقع')).not.toBeInTheDocument();
        expect(screen.getByText('اختر مدة اشتراكك')).toBeInTheDocument();
      },
      { timeout: 12000 }
    );
  }, 15000);

  it('renders request-access signup flow without ErrorBoundary crash', async () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <AuthProvider>
          <StoreBootstrapProvider>
            <RequestAccess />
          </StoreBootstrapProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.queryByText('حدث خطأ غير متوقع')).not.toBeInTheDocument();
        expect(screen.getByText('اختر مدة اشتراكك')).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
  });

  it('renders login without ErrorBoundary crash', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <StoreBootstrapProvider>
            <Login />
          </StoreBootstrapProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(
      () => {
        expect(screen.queryByText('حدث خطأ غير متوقع')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
  });
});
