
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginUser, registerUser, initializeOwnerContext, RestaurantOwner } from '@/lib/auth';

interface AuthContextType {
  user: RestaurantOwner | null;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string, restaurantName?: string) => Promise<{ error?: string }>;
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
  const [user, setUser] = useState<RestaurantOwner | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('restaurantOwner');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Initialize the database context for RLS policies
          await initializeOwnerContext(parsedUser.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Clear invalid stored data
        localStorage.removeItem('restaurantOwner');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const result = await loginUser(username, password);
      if (result.error) {
        return { error: result.error };
      }
      
      if (result.user) {
        setUser(result.user);
        localStorage.setItem('restaurantOwner', JSON.stringify(result.user));
      }
      
      return {};
    } catch (error) {
      return { error: 'حدث خطأ أثناء تسجيل الدخول' };
    }
  };

  const register = async (username: string, password: string, restaurantName?: string) => {
    try {
      const result = await registerUser(username, password, restaurantName);
      if (result.error) {
        return { error: result.error };
      }
      
      if (result.user) {
        setUser(result.user);
        localStorage.setItem('restaurantOwner', JSON.stringify(result.user));
      }
      
      return {};
    } catch (error) {
      return { error: 'حدث خطأ أثناء إنشاء الحساب' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('restaurantOwner');
    // Clear the database context
    // Note: The context will be cleared when the page refreshes or user logs in again
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
