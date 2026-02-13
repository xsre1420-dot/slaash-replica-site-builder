import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ClipboardList, BarChart3, Settings } from "lucide-react";

const navItems = [
  { to: "/settings", icon: Settings, label: "الإعدادات" },
  { to: "/statistics", icon: BarChart3, label: "الإحصائيات" },
  { to: "/orders", icon: ClipboardList, label: "الطلبات" },
  { to: "/products", icon: Package, label: "المنتجات" },
  { to: "/builder", icon: LayoutDashboard, label: "الرئيسية" },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[56px] ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
