import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Package, ShoppingCart, Users, Settings, Tag, List, Eye, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const sidebarItems: SidebarItem[] = [
  { icon: BarChart3, label: 'الإحصائيات', path: '/statistics' },
  { icon: List, label: 'الطلبات', path: '/orders' },
  { icon: Package, label: 'المنتجات', path: '/products' },
  { icon: ShoppingCart, label: 'الطلبات', path: '/orders' },
  { icon: Users, label: 'العملاء', path: '/customers' },
  { icon: Settings, label: 'الإعدادات', path: '/settings' },
  { icon: Tag, label: 'الأصناف', path: '/categories' },
  { icon: Eye, label: 'معاينة', path: '/preview' },
];

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RightSidebar({ isOpen, onClose }: RightSidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed right-0 top-0 h-full w-20 md:w-24 bg-gradient-to-b from-purple-600 to-indigo-600 z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      } shadow-2xl`}>
        
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:bg-white/20 md:hidden"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Sidebar Content */}
        <div className="flex flex-col items-center py-6 h-full">
          
          {/* Navigation Items */}
          <div className="flex-1 flex flex-col items-center gap-4 mt-8">
            {sidebarItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <Link
                  key={index}
                  to={item.path}
                  onClick={onClose}
                  className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-white/25 shadow-lg' 
                      : 'hover:bg-white/15'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-6 h-6 transition-colors ${
                    isActive ? 'text-white' : 'text-white/80 group-hover:text-white'
                  }`} />
                  
                  {/* Tooltip */}
                  <div className="absolute right-full mr-3 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Logout Button */}
          <div className="mt-auto mb-6">
            <Button
              onClick={handleLogout}
              className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/20 hover:bg-red-500/30 transition-all duration-200"
              title="تسجيل الخروج"
            >
              <LogOut className="w-6 h-6 text-white/80 group-hover:text-white" />
              
              {/* Tooltip */}
              <div className="absolute right-full mr-3 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                تسجيل الخروج
              </div>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}