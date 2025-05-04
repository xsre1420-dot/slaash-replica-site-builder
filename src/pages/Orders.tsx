
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Archive, Calendar, Eye, Search, CalendarRange } from "lucide-react";
import { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Demo orders data
const demoOrders: Order[] = [
  {
    id: "ord-001",
    items: [
      {
        product: {
          id: "p1",
          name: "برجر لحم",
          description: "برجر لحم مشوي مع صوص خاص",
          category: "وجبات سريعة",
          price: 8000,
          image: "/placeholder.svg",
        },
        quantity: 2,
      },
      {
        product: {
          id: "p2",
          name: "بطاطس",
          description: "بطاطس مقلية مقرمشة",
          category: "إضافات",
          price: 3000,
          image: "/placeholder.svg",
        },
        quantity: 1,
      },
    ],
    customerInfo: {
      name: "أحمد محمد",
      phone: "07701234567",
      address: "بغداد - الكرادة",
      notes: "الرجاء التوصيل سريعاً",
    },
    total: 19000,
    date: "2025-05-03T14:30:00",
    status: "completed",
  },
  {
    id: "ord-002",
    items: [
      {
        product: {
          id: "p3",
          name: "شاورما دجاج",
          description: "شاورما دجاج مع صوص ثوم",
          category: "وجبات سريعة",
          price: 6000,
          image: "/placeholder.svg",
        },
        quantity: 3,
      },
    ],
    customerInfo: {
      name: "سارة علي",
      phone: "07709876543",
      address: "بغداد - المنصور",
    },
    total: 18000,
    date: "2025-05-02T19:45:00",
    status: "completed",
  },
  {
    id: "ord-003",
    items: [
      {
        product: {
          id: "p4",
          name: "معجنات مشكلة",
          description: "تشكيلة من المعجنات الطازجة",
          category: "معجنات",
          price: 12000,
          image: "/placeholder.svg",
        },
        quantity: 1,
      },
    ],
    customerInfo: {
      name: "محمد حسين",
      phone: "07712345678",
      address: "بغداد - زيونة",
    },
    total: 12000,
    date: "2025-05-01T11:15:00",
    status: "completed",
  },
];

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  useEffect(() => {
    // In a real app, we would fetch orders from an API
    setOrders(demoOrders);
    setFilteredOrders(demoOrders);
  }, []);

  useEffect(() => {
    filterOrders();
  }, [searchQuery, dateFilter, orders]);

  const filterOrders = () => {
    let filtered = [...orders];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.customerInfo.name.includes(searchQuery) ||
          order.customerInfo.phone.includes(searchQuery) ||
          order.id.includes(searchQuery)
      );
    }

    // Filter by date
    if (dateFilter) {
      const filterDate = format(dateFilter, "yyyy-MM-dd");
      filtered = filtered.filter((order) => 
        order.date.startsWith(filterDate)
      );
    }

    setFilteredOrders(filtered);
  };

  const archiveOrder = (orderId: string) => {
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, status: "cancelled" as "pending" | "completed" | "cancelled" } : order
    );
    setOrders(updatedOrders);
  };

  const clearDateFilter = () => {
    setDateFilter(undefined);
  };

  return (
    <div className="min-h-screen bg-gray-50 rtl">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <div className="flex justify-between items-center">
          <Link to="/builder">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">إدارة الطلبات</h1>
          <div className="w-6"></div> {/* Empty div for alignment */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-right">الطلبات</CardTitle>
            <CardDescription className="text-right">
              عرض وإدارة طلبات العملاء
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Input
                  placeholder="بحث بالاسم أو رقم الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-right"
                />
                <Button variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-right font-normal",
                        !dateFilter && "text-muted-foreground"
                      )}
                    >
                      {dateFilter ? format(dateFilter, "yyyy-MM-dd") : "تصفية حسب التاريخ"}
                      <CalendarRange className="mr-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFilter}
                      onSelect={setDateFilter}
                      className={cn("p-3 pointer-events-auto")}
                    />
                    <div className="p-3 border-t border-border">
                      <Button
                        variant="ghost"
                        className="w-full text-xs"
                        onClick={clearDateFilter}
                      >
                        مسح التصفية
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border mt-4">
                <div className="flex justify-center mb-4">
                  <CalendarRange className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد طلبات</h3>
                <p className="text-gray-500">لم يتم العثور على طلبات تطابق معايير البحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الطلب</TableHead>
                      <TableHead className="text-right">اسم العميل</TableHead>
                      <TableHead className="text-right">رقم الهاتف</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className={order.status === "cancelled" ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{order.customerInfo.name}</TableCell>
                        <TableCell>{order.customerInfo.phone}</TableCell>
                        <TableCell>{order.customerInfo.address}</TableCell>
                        <TableCell>{format(new Date(order.date), "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell>{order.total.toLocaleString()} د.ع</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              asChild
                            >
                              <Link to={`/orders/${order.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => archiveOrder(order.id)}
                              disabled={order.status === "cancelled"}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
