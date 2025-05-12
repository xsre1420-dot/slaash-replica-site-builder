
import { X, ArrowRight, Plus, Minus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Order } from "@/types";

const Checkout = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      toast({
        title: "خطأ في المعلومات",
        description: "يرجى تعبئة جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }
    
    // Create a new order object
    const newOrder: Order = {
      id: `ord-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      items: [...cartItems],
      customerInfo: {
        name: customerInfo.name,
        phone: customerInfo.phone,
        address: customerInfo.address,
        notes: customerInfo.notes || undefined,
      },
      total: cartTotal,
      date: new Date().toISOString(),
      status: 'pending',
    };
    
    // In a real app, we would save the order to a backend
    // For now, we can store it in localStorage for demo purposes
    const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = [newOrder, ...existingOrders];
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    
    // Show simple success notification
    toast({
      title: "تم الطلب بنجاح",
      className: "bg-green-500 text-white border-green-600 mx-auto max-w-fit",
    });
    
    clearCart();
    // Navigate to thank you page or back to store
    navigate("/preview");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <div className="flex justify-between items-center">
          <Link to="/preview">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">إتمام الطلب</h1>
          <div className="w-6"></div> {/* Empty div for alignment */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto p-4">
        {cartItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm mt-4">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">سلة التسوق فارغة</h3>
            <p className="text-gray-500">قم بإضافة بعض المنتجات للاستمرار بالطلب</p>
            <Link to="/preview">
              <Button className="mt-6 bg-red-600 hover:bg-red-700">
                العودة للمنيو
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="bg-white rounded-xl shadow-sm p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right">طلبك</h2>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.product.id} className="flex items-start justify-between border-b pb-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div className="flex items-center mx-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-gray-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="mx-2 w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-gray-600"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="text-right">
                        <span className="block font-bold">{item.product.name}</span>
                        <span className="text-gray-600 text-sm">{item.product.price.toLocaleString()} د.ع × {item.quantity}</span>
                      </div>
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-12 h-12 rounded-md object-cover mr-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t">
                <span className="font-bold text-lg">{cartTotal.toLocaleString()} د.ع</span>
                <span className="font-bold">المجموع:</span>
              </div>
            </div>
            
            {/* Customer Info Form */}
            <form onSubmit={handleSubmitOrder} className="bg-white rounded-xl shadow-sm p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right">معلومات التوصيل</h2>
              
              <div className="space-y-4">
                <div className="text-right">
                  <Label htmlFor="name" className="block mb-1">الاسم</Label>
                  <Input
                    id="name"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleInputChange}
                    className="text-right"
                    required
                  />
                </div>
                
                <div className="text-right">
                  <Label htmlFor="phone" className="block mb-1">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={customerInfo.phone}
                    onChange={handleInputChange}
                    className="text-right"
                    required
                  />
                </div>
                
                <div className="text-right">
                  <Label htmlFor="address" className="block mb-1">العنوان</Label>
                  <Input
                    id="address"
                    name="address"
                    value={customerInfo.address}
                    onChange={handleInputChange}
                    className="text-right"
                    required
                  />
                </div>
                
                <div className="text-right">
                  <Label htmlFor="notes" className="block mb-1">ملاحظات إضافية (اختياري)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={customerInfo.notes}
                    onChange={handleInputChange}
                    className="text-right"
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 mt-6">
                تأكيد الطلب
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Checkout;
