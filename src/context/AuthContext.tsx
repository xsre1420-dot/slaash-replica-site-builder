
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RestaurantOwner } from '@/lib/auth';

interface AuthContextType {
  user: RestaurantOwner | null;
  login: (user: RestaurantOwner) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<RestaurantOwner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // التحقق من وجود جلسة محفوظة
    const savedUser = localStorage.getItem('restaurant_owner');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('restaurant_owner');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: RestaurantOwner) => {
    setUser(userData);
    localStorage.setItem('restaurant_owner', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('restaurant_owner');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
