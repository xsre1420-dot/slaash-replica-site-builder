
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, CheckCircle, XCircle, Clock, ArrowLeft, AlertCircle, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrders } from "@/components/orders/useOrders";
import { format } from "date-fns";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

const Orders = () => {
  const { filteredOrders, searchQuery, setSearchQuery, updateOrderStatus } = useOrders();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const { toast } = useToast();

  const handleStatusChange = (orderId: string, newStatus: "pending" | "completed" | "cancelled") => {
    updateOrderStatus(orderId, newStatus);
    
    const statusMessages = {
      completed: "تم تحديث حالة الطلب إلى مكتمل",
      pending: "تم تحديث حالة الطلب إلى قيد الانتظار",
      cancelled: "تم تحديث حالة الطلب إلى ملغي"
    };
    
    toast({
      title: statusMessages[newStatus],
      duration: 2000
    });
  };

  const getStatusBadge = (status: string, orderId: string) => {
    const statusConfig = {
      completed: { label: "مكتمل", icon: CheckCircle, color: "bg-green-100 text-green-800" },
      pending: { label: "قيد الانتظار", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
      cancelled: { label: "ملغي", icon: XCircle, color: "bg-red-100 text-red-800" }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge className={`${config.color} border-0 cursor-pointer hover:opacity-80`}>
            <Icon className="w-3 h-3 ml-1" />
            {config.label}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleStatusChange(orderId, "completed")}>
            <CheckCircle className="h-4 w-4 ml-2" />
            <span>مكتمل</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(orderId, "pending")}>
            <Clock className="h-4 w-4 ml-2" />
            <span>قيد الانتظار</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange(orderId, "cancelled")}>
            <XCircle className="h-4 w-4 ml-2" />
            <span>ملغي</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getFilteredOrders = () => {
    let filtered = filteredOrders;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Filter by date
    if (dateFilter !== "all") {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      
      switch (dateFilter) {
        case "today":
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.date);
            return format(orderDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
          });
          break;
        case "yesterday":
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.date);
            return format(orderDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd");
          });
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.date);
            return orderDate >= weekAgo;
          });
          break;
        case "month":
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.date);
            return format(orderDate, "yyyy-MM") === format(today, "yyyy-MM");
          });
          break;
      }
    }

    return filtered;
  };

  const displayedOrders = getFilteredOrders();

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">إدارة الطلبات</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="البحث عن طلب أو عميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 rounded-2xl border-gray-200"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-2xl border-gray-200">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="rounded-2xl border-gray-200">
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">جميع التواريخ</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="yesterday">أمس</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              className="rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
              onClick={() => {
                setStatusFilter("all");
                setDateFilter("all");
                setSearchQuery("");
              }}
            >
              مسح الفلاتر
            </Button>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedOrders.map((order) => (
            <Card key={order.id} className="border-0 shadow-sm rounded-3xl hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <CardTitle className="text-lg">{order.customerInfo.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">
                      {order.id}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.status, order.id)}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-2">المنتجات:</p>
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <span key={index} className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm ml-1 mb-1">
                          {item.product.name} ({item.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-left">
                      <p className="text-sm text-gray-500">{format(new Date(order.date), "yyyy-MM-dd")}</p>
                      <p className="text-sm text-gray-500">{format(new Date(order.date), "hh:mm a")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {order.total.toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                  
                  <Link to={`/orders/${order.id}`}>
                    <Button 
                      className="w-full rounded-2xl mt-3"
                      style={{ 
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      <Eye className="w-4 h-4 ml-2" />
                      عرض التفاصيل
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {displayedOrders.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد طلبات</h3>
            <p className="text-gray-500">لم يتم العثور على طلبات تطابق معايير البحث</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
