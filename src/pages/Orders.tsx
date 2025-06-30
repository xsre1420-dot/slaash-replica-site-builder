
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, CheckCircle, XCircle, Clock, ArrowLeft, AlertCircle } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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
      completed: { label: "مكتمل", icon: CheckCircle, color: "bg-green-100 text-green-800 hover:bg-green-200" },
      pending: { label: "قيد الانتظار", icon: Clock, color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
      cancelled: { label: "ملغي", icon: XCircle, color: "bg-red-100 text-red-800 hover:bg-red-200" }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge className={`${config.color} border-0 cursor-pointer transition-colors`}>
            <Icon className="w-3 h-3 ml-1" />
            {config.label}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white shadow-lg border rounded-lg z-50">
          <DropdownMenuItem 
            onClick={() => handleStatusChange(orderId, "completed")}
            className="cursor-pointer hover:bg-green-50"
          >
            <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
            <span>مكتمل</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleStatusChange(orderId, "pending")}
            className="cursor-pointer hover:bg-yellow-50"
          >
            <Clock className="h-4 w-4 ml-2 text-yellow-600" />
            <span>قيد الانتظار</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleStatusChange(orderId, "cancelled")}
            className="cursor-pointer hover:bg-red-50"
          >
            <XCircle className="h-4 w-4 ml-2 text-red-600" />
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 font-arabic">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-3 hover:bg-blue-500/20 rounded-xl text-white">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">إدارة الطلبات</h1>
            <div className="w-12"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-400 w-5 h-5" />
              <Input
                placeholder="البحث عن طلب أو عميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-12 rounded-2xl border-blue-200 focus:border-blue-400 focus:ring-blue-400/20"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-2xl border-blue-200 focus:border-blue-400">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white shadow-lg border z-50">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="rounded-2xl border-blue-200 focus:border-blue-400">
                <SelectValue placeholder="التاريخ" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl bg-white shadow-lg border z-50">
                <SelectItem value="all">جميع التواريخ</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="yesterday">أمس</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayedOrders.map((order) => (
            <Card key={order.id} className="border-0 shadow-xl rounded-3xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white border-blue-100">
              <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-3xl">
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <CardTitle className="text-xl text-blue-800">{order.customerInfo.name}</CardTitle>
                    <CardDescription className="text-sm text-blue-600 mt-1 font-medium">
                      {order.id}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.status, order.id)}
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-right">
                    <p className="text-sm text-blue-700 mb-3 font-semibold">المنتجات:</p>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <span key={index} className="inline-block bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm ml-1 mb-2 border border-blue-200">
                          {item.product.name} ({item.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-blue-100">
                    <div className="text-left">
                      <p className="text-sm text-blue-600 font-medium">{format(new Date(order.date), "yyyy-MM-dd")}</p>
                      <p className="text-sm text-blue-500">{format(new Date(order.date), "hh:mm a")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-700">
                        {order.total.toLocaleString()} د.ع
                      </p>
                    </div>
                  </div>
                  
                  <Link to={`/orders/${order.id}`}>
                    <Button 
                      className="w-full rounded-2xl mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
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
          <div className="text-center py-16 bg-white rounded-3xl shadow-xl">
            <AlertCircle className="w-20 h-20 text-blue-300 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-blue-800 mb-3">لا توجد طلبات</h3>
            <p className="text-blue-600">لم يتم العثور على طلبات تطابق معايير البحث</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
