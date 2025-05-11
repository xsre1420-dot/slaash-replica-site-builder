
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { Order } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";

// Same demo orders for testing
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

const OrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    // Try to get orders from localStorage first
    const storedOrders = localStorage.getItem('orders');
    let foundOrder = null;
    
    if (storedOrders) {
      try {
        const parsedOrders = JSON.parse(storedOrders);
        foundOrder = parsedOrders.find((o: Order) => o.id === orderId);
      } catch (error) {
        console.error('Error parsing stored orders:', error);
      }
    }
    
    // If not found in localStorage, check demo orders
    if (!foundOrder) {
      foundOrder = demoOrders.find((o) => o.id === orderId);
    }
    
    if (foundOrder) {
      setOrder(foundOrder);
    }
  }, [orderId]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">الطلب غير موجود</h2>
          <Link to="/orders">
            <Button className="mt-4">العودة للطلبات</Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: 'pending' | 'completed' | 'cancelled') => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1">
            <Check className="h-3 w-3" />
            مكتمل
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
            <X className="h-3 w-3" />
            ملغي
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            قيد الانتظار
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 rtl">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <div className="flex justify-between items-center">
          <Link to="/orders">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">تفاصيل الطلب #{order.id}</h1>
          <div className="w-6"></div> {/* Empty div for alignment */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto p-4">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 ml-2" />
                <span>{format(new Date(order.date), "yyyy-MM-dd hh:mm a")}</span>
              </div>
              <div>
                <CardTitle className="text-right flex items-center justify-end gap-2">
                  تفاصيل الطلب
                  {getStatusBadge(order.status)}
                </CardTitle>
                <CardDescription className="text-right">
                  {order.id}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-right">معلومات العميل</h3>
                <div className="space-y-2 text-right">
                  <div className="flex justify-between">
                    <span>{order.customerInfo.name}</span>
                    <span className="font-medium">الاسم:</span>
                  </div>
                  <div className="flex justify-between">
                    <span dir="ltr">{order.customerInfo.phone}</span>
                    <span className="font-medium">رقم الهاتف:</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{order.customerInfo.address}</span>
                    <span className="font-medium">العنوان:</span>
                  </div>
                  {order.customerInfo.notes && (
                    <div className="flex justify-between">
                      <span>{order.customerInfo.notes}</span>
                      <span className="font-medium">ملاحظات:</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-right">المنتجات</h3>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={`${item.product.id}-${index}`}
                      className="flex justify-between items-center border-b pb-3"
                    >
                      <div className="flex items-center">
                        <div>
                          <span className="block font-medium">{item.product.price.toLocaleString()} د.ع × {item.quantity}</span>
                          <span className="text-gray-500 text-sm">
                            المجموع: {(item.product.price * item.quantity).toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="text-right ml-3">
                          <span className="block font-semibold">{item.product.name}</span>
                          <span className="text-gray-600 text-sm line-clamp-1">
                            {item.product.description}
                          </span>
                        </div>
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-16 h-16 rounded-lg object-cover border border-gray-200 shadow-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total */}
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">{order.total.toLocaleString()} د.ع</span>
                  <span className="font-bold">المجموع الكلي:</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderDetails;
