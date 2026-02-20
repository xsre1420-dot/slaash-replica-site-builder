
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  store_name?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (email: string, password: string, username: string, storeName?: string) => Promise<{ error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const meta: any = session.user.user_metadata ?? {};
        setUser({
          id: session.user.id,
          username: meta.username || session.user.email?.split('@')[0] || 'مستخدم',
          store_name: meta.store_name
        });

        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile) {
              setUser({ id: profile.id, username: profile.username, store_name: profile.store_name });
            }
          } catch (e) {
            console.warn('Profile fetch skipped/failed:', e);
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          const meta: any = session.user.user_metadata ?? {};
          setUser({
            id: session.user.id,
            username: meta.username || session.user.email?.split('@')[0] || 'مستخدم',
            store_name: meta.store_name
          });
        } else {
          setUser(null);
        }
      })
      .catch((error) => {
        console.error('Error initializing auth:', error);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'يرجى تأكيد بريدك الإلكتروني أولاً' };
        }
        return { error: error.message };
      }
      return {};
    } catch {
      return { error: 'حدث خطأ في الاتصال. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.' };
    }
  };

  const register = async (email: string, password: string, username: string, storeName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/builder`,
          data: {
            username,
            store_name: storeName || 'متجري'
          }
        }
      });
      
      if (error) {
        return { error: error.message };
      }
      
      return {};
    } catch (error) {
      return { error: 'حدث خطأ أثناء إنشاء الحساب' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
