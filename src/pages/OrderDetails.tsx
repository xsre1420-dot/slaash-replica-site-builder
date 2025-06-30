
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Order } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import CustomerInfo from "@/components/order-details/CustomerInfo";
import OrderItems from "@/components/order-details/OrderItems";
import OrderTotal from "@/components/order-details/OrderTotal";
import OrderHeader from "@/components/order-details/OrderHeader";

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-3xl shadow-xl border border-blue-100">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">الطلب غير موجود</h2>
          <Link to="/orders">
            <Button 
              className="mt-6 text-white border-0 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-3"
            >
              العودة للطلبات
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 font-arabic">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <Link to="/orders">
              <Button variant="ghost" className="p-3 hover:bg-blue-500/20 rounded-xl text-white">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">تفاصيل الطلب #{order.id}</h1>
            <div className="w-12"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Card className="mb-8 border-0 shadow-2xl bg-white rounded-3xl overflow-hidden border-blue-100">
          <CardHeader className="rounded-t-3xl bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
            <OrderHeader 
              orderId={order.id} 
              date={order.date} 
              status={order.status} 
            />
          </CardHeader>
          <CardContent className="bg-white rounded-b-3xl p-10">
            <div className="space-y-10">
              {/* Customer Info */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-3xl p-8 border border-blue-200">
                <h3 className="text-xl font-bold text-blue-800 mb-6 text-right">معلومات العميل</h3>
                <CustomerInfo customerInfo={order.customerInfo} />
              </div>

              {/* Order Items */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-3xl p-8 border border-blue-200">
                <h3 className="text-xl font-bold text-blue-800 mb-6 text-right">تفاصيل الطلب</h3>
                <OrderItems items={order.items} />
              </div>

              {/* Order Total */}
              <OrderTotal total={order.total} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderDetails;
