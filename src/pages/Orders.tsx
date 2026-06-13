
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, CheckCircle, XCircle, Clock, Package, TrendingUp, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { copyStorePublicUrl } from "@/lib/storeUrl";

import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";

const Orders = () => {
  const { user } = useAuth();
  const { filteredOrders, searchQuery, setSearchQuery, updateOrderStatus, loading, hasMore, loadMore, refetch } = useOrders();
  useRealtimeOrders(refetch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const handleStatusChange = async (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    const success = await updateOrderStatus(orderId, newStatus);
    if (success) {
      const statusMessages = {
        completed: "تم تحديث حالة الطلب إلى مكتمل",
        pending: "تم تحديث حالة الطلب إلى قيد الانتظار",
        cancelled: "تم تحديث حالة الطلب إلى ملغي",
      };
      toast.success(statusMessages[newStatus], { duration: 2000 });
    }
  };

  const handleCopyStoreLink = async () => {
    if (!user?.id) return;
    try {
      const url = await copyStorePublicUrl(user.id, user.username);
      if (!url) {
        toast.error("حدّد رابط المتجر (slug) من الإعدادات أولاً");
        return;
      }
      toast.success("تم نسخ رابط المتجر — شاركه مع عملائك!");
    } catch {
      toast.error("فشل في نسخ الرابط");
    }
  };

  const displayedOrders = useMemo(() => {
    let filtered = filteredOrders;
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    if (dateFilter !== "all") {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 86400000);
      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(order => format(new Date(order.date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"));
          break;
        case "yesterday":
          filtered = filtered.filter(order => format(new Date(order.date), "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd"));
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 86400000);
          filtered = filtered.filter(order => new Date(order.date) >= weekAgo);
          break;
        case "month":
          filtered = filtered.filter(order => format(new Date(order.date), "yyyy-MM") === format(today, "yyyy-MM"));
          break;
      }
    }
    return filtered;
  }, [filteredOrders, statusFilter, dateFilter]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const pending = filteredOrders.filter(o => o.status === "pending").length;
    const completed = filteredOrders.filter(o => o.status === "completed").length;
    const totalRevenue = filteredOrders.filter(o => o.status === "completed").reduce((sum, o) => sum + o.total, 0);
    return { total, pending, completed, totalRevenue };
  }, [filteredOrders]);

  const statusConfig = {
    completed: { label: "مكتمل", icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    pending: { label: "قيد الانتظار", icon: Clock, className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    cancelled: { label: "ملغي", icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="إدارة الطلبات"
        description="تابع وحدّث حالة طلبات عملائك"
        hideBack
        breadcrumbs={[{ label: 'لوحة التحكم', href: '/builder' }, { label: 'الطلبات' }]}
      />

      <div className="ds-page">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الطلبات" value={stats.total} icon={Package} />
          <StatCard label="قيد الانتظار" value={stats.pending} icon={Clock} iconClassName="bg-warning/10 [&_svg]:text-warning" />
          <StatCard label="مكتمل" value={stats.completed} icon={CheckCircle} iconClassName="bg-success/10 [&_svg]:text-success" />
          <StatCard label="الإيرادات (د.ع)" value={stats.totalRevenue.toLocaleString()} icon={TrendingUp} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="البحث عن طلب أو عميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10 rounded-xl border-border text-foreground" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl border-border text-foreground"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
                <SelectContent className="rounded-xl bg-popover border-border">
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="rounded-xl border-border text-foreground"><SelectValue placeholder="التاريخ" /></SelectTrigger>
                <SelectContent className="rounded-xl bg-popover border-border">
                  <SelectItem value="all">جميع التواريخ</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="yesterday">أمس</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="rounded-xl border-border text-foreground" onClick={() => { setStatusFilter("all"); setDateFilter("all"); setSearchQuery(""); }}>
                مسح الفلاتر
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        {loading && filteredOrders.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-full rounded-xl mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedOrders.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedOrders.map((order) => {
                const config = statusConfig[order.status as keyof typeof statusConfig];
                const StatusIcon = config.icon;
                return (
                  <Card key={order.id} className="overflow-hidden hover:shadow-brand transition-all duration-200">
                    <CardHeader className="pb-3 px-5 pt-5">
                      <div className="flex justify-between items-start gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge className={`${config.className} border-0 cursor-pointer transition-colors shrink-0`}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {config.label}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-popover border-border rounded-xl">
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, "completed")} className="cursor-pointer">
                              <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                              مكتمل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, "pending")} className="cursor-pointer">
                              <Clock className="h-4 w-4 ml-2 text-yellow-600" />
                              قيد الانتظار
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, "cancelled")} className="cursor-pointer">
                              <XCircle className="h-4 w-4 ml-2 text-red-600" />
                              ملغي
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="text-right min-w-0">
                          <CardTitle className="text-base truncate text-foreground">{order.customerInfo.name}</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate">{order.id}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <div className="space-y-3">
                        <div className="text-right">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {order.items.slice(0, 3).map((item, index) => (
                              <span key={index} className="inline-block bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs">
                                {item.product.name} ({item.quantity})
                              </span>
                            ))}
                            {order.items.length > 3 && (
                              <span className="inline-block bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full text-xs">+{order.items.length - 3} أخرى</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-border">
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">{format(new Date(order.date), "yyyy-MM-dd")}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.date), "hh:mm a")}</p>
                          </div>
                          <p className="text-lg font-bold text-foreground">
                            {order.total.toLocaleString()} <span className="text-xs text-muted-foreground">د.ع</span>
                          </p>
                        </div>
                        <Link to={`/orders/${order.id}`} className="block">
                          <Button variant="outline" className="w-full rounded-xl border-border text-foreground hover:bg-muted">
                            <Eye className="w-4 h-4 ml-2" />
                            عرض التفاصيل
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" onClick={loadMore} disabled={loading} className="rounded-xl border-border text-foreground">
                  {loading ? "جارٍ التحميل..." : "تحميل المزيد"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="لا توجد طلبات بعد"
            description={
              searchQuery || statusFilter !== "all" || dateFilter !== "all"
                ? "لم يتم العثور على طلبات تطابق معايير البحث"
                : "شارك رابط متجرك مع عملائك للحصول على أول طلب"
            }
            actionLabel={!searchQuery && statusFilter === "all" && dateFilter === "all" ? "نسخ رابط المتجر" : "مسح الفلاتر"}
            onAction={
              !searchQuery && statusFilter === "all" && dateFilter === "all"
                ? handleCopyStoreLink
                : () => { setStatusFilter("all"); setDateFilter("all"); setSearchQuery(""); }
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Orders;
