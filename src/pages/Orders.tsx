
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Search, Filter, Eye, Package, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const Orders = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Sample orders data
  const [orders] = useState([
    {
      id: "ORD-001",
      customerName: "أحمد محمد",
      items: ["برجر لحم", "بطاطس مقلية"],
      total: 45000,
      status: "completed",
      date: "2024-01-15",
      time: "14:30"
    },
    {
      id: "ORD-002", 
      customerName: "فاطمة علي",
      items: ["بيتزا مارجريتا", "كولا"],
      total: 38000,
      status: "pending",
      date: "2024-01-15",
      time: "15:20"
    },
    {
      id: "ORD-003",
      customerName: "محمد حسن",
      items: ["شاورما دجاج"],
      total: 25000,
      status: "preparing",
      date: "2024-01-14",
      time: "13:45"
    },
    {
      id: "ORD-004",
      customerName: "سارة أحمد",
      items: ["سلطة قيصر", "عصير برتقال"],
      total: 22000,
      status: "cancelled",
      date: "2024-01-14",
      time: "12:15"
    }
  ]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "مكتمل", variant: "default" as const, icon: CheckCircle, color: "bg-green-100 text-green-800" },
      pending: { label: "في الانتظار", variant: "secondary" as const, icon: Clock, color: "bg-yellow-100 text-yellow-800" },
      preparing: { label: "قيد التحضير", variant: "outline" as const, icon: Package, color: "bg-blue-100 text-blue-800" },
      cancelled: { label: "ملغي", variant: "destructive" as const, icon: XCircle, color: "bg-red-100 text-red-800" }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0`}>
        <Icon className="w-3 h-3 ml-1" />
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesDate = dateFilter === "all" || order.date === dateFilter;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

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
            <Link to="/statistics">
              <Button 
                className="rounded-2xl text-white shadow-lg flex items-center gap-2"
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                }}
              >
                <BarChart3 className="w-5 h-5" />
                الإحصائيات
              </Button>
            </Link>
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 rounded-2xl border-gray-200"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-2xl border-gray-200">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">في الانتظار</SelectItem>
                <SelectItem value="preparing">قيد التحضير</SelectItem>
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
                <SelectItem value="2024-01-15">اليوم</SelectItem>
                <SelectItem value="2024-01-14">أمس</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              className="rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
            >
              تطبيق الفلتر
            </Button>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="border-0 shadow-sm rounded-3xl hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <CardTitle className="text-lg">{order.customerName}</CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1">
                      {order.id}
                    </CardDescription>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-2">المنتجات:</p>
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <span key={index} className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm ml-1 mb-1">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-left">
                      <p className="text-sm text-gray-500">{order.date}</p>
                      <p className="text-sm text-gray-500">{order.time}</p>
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

        {filteredOrders.length === 0 && (
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
