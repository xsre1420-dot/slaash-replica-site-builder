import { NavLink, useLocation } from "react-router-dom";
import { 
  Copy, 
  Plus, 
  Eye, 
  Package, 
  List, 
  BarChart3, 
  Settings, 
  Archive, 
  TrendingUp 
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useState } from "react";

const menuItems = [
  { title: "نسخ رابط المتجر", url: "/builder", icon: Copy, action: "copy", highlight: true },
  { title: "إضافة منتج", url: "/add-product", icon: Plus, highlight: true },
  { title: "معاينة المتجر", url: "/preview", icon: Eye },
  { title: "المنتجات", url: "/products", icon: Package },
  { title: "الطلبات", url: "/orders", icon: List },
  { title: "الإحصائيات", url: "/statistics", icon: BarChart3 },
  { title: "الإعدادات", url: "/settings", icon: Settings },
  { title: "المخزون", url: "/inventory", icon: Archive },
  { title: "التسويق", url: "/marketing", icon: TrendingUp },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const collapsed = !open;
  const location = useLocation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/store/${user.username}`);
        setCopied(true);
        toast.success("تم نسخ الرابط بنجاح!");
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error("فشل في نسخ الرابط");
      }
    }
  };

  const getNavCls = (active: boolean, highlight?: boolean) => {
    if (active) {
      return "bg-primary/20 text-white font-semibold";
    }
    return highlight 
      ? "text-white hover:bg-primary/30 transition-all duration-200" 
      : "text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200";
  };

  return (
    <Sidebar
      side="right"
      className={`${collapsed ? "w-20" : "w-64"} transition-all duration-300 bg-gradient-to-b from-primary via-primary/95 to-primary/90 border-l border-white/10`}
      collapsible="icon"
    >
      <SidebarContent className="pt-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2 px-3">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.action === "copy" ? (
                    <SidebarMenuButton
                      onClick={handleCopyLink}
                      className={`${getNavCls(false, item.highlight)} ${
                        item.highlight && !collapsed ? "bg-white/20 rounded-2xl" : "rounded-xl"
                      } h-14 ${collapsed ? "justify-center" : "justify-end"}`}
                      tooltip={collapsed ? item.title : undefined}
                    >
                      <div className={`flex items-center gap-3 ${collapsed ? "" : "flex-row-reverse"}`}>
                        <div
                          className={`${
                            item.highlight ? "bg-white/30 p-2.5 rounded-xl" : ""
                          } flex items-center justify-center`}
                        >
                          <item.icon className={`${collapsed ? "h-6 w-6" : "h-5 w-5"}`} />
                        </div>
                        {!collapsed && <span className="text-base">{item.title}</span>}
                      </div>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                      <NavLink
                        to={item.url}
                        className={`${getNavCls(isActive(item.url), item.highlight)} ${
                          item.highlight && !collapsed ? "bg-white/20 rounded-2xl" : "rounded-xl"
                        } h-14 flex items-center ${collapsed ? "justify-center" : "justify-end"}`}
                      >
                        <div className={`flex items-center gap-3 ${collapsed ? "" : "flex-row-reverse"}`}>
                          <div
                            className={`${
                              item.highlight ? "bg-white/30 p-2.5 rounded-xl" : ""
                            } flex items-center justify-center`}
                          >
                            <item.icon className={`${collapsed ? "h-6 w-6" : "h-5 w-5"}`} />
                          </div>
                          {!collapsed && <span className="text-base">{item.title}</span>}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
