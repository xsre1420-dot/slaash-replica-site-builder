
import { X, ArrowRight, Plus, Minus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Order } from "@/types";

const Checkout = () => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  const { storeSettings } = useStore();
  const navigate = useNavigate();
  
  const [orderCompleted, setOrderCompleted] = useState(false);
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  
  // Get selected delivery price
  const selectedDeliveryPrice = selectedGovernorate 
    ? storeSettings.deliveryPrices?.find(d => d.governorate === selectedGovernorate)?.price || 0
    : 0;
  
  // Calculate total with delivery
  const totalWithDelivery = cartTotal + selectedDeliveryPrice;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      return; // Just return without showing error notification
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
      total: totalWithDelivery,
      date: new Date().toISOString(),
      status: 'pending',
    };
    
    // In a real app, we would save the order to a backend
    // For now, we can store it in localStorage for demo purposes
    const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = [newOrder, ...existingOrders];
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    
    // Show order completion notification
    setOrderCompleted(true);
    
    // Hide notification after 3 seconds and navigate
    setTimeout(() => {
      setOrderCompleted(false);
      clearCart();
      navigate("/preview");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="text-white p-4" style={{ 
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
      }}>
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
            <h3 className="text-xl font-bold text-black mb-2">سلة التسوق فارغة</h3>
            <p className="text-black">قم بإضافة بعض المنتجات للاستمرار بالطلب</p>
            <Link to="/preview">
              <Button 
                className="mt-6 text-white shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
                }}
              >
                العودة للمتجر
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="bg-white rounded-xl shadow-sm p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right text-black">طلبك</h2>
              <div className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={`${item.product.id}-${item.selectedSize || 'no-size'}-${item.selectedColor || 'no-color'}-${index}`} className="flex items-start justify-between border-b pb-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <div className="flex items-center mx-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                          className="rounded-full w-6 h-6 flex items-center justify-center text-white shadow-lg"
                          style={{ 
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="mx-2 w-6 text-center text-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                          className="rounded-full w-6 h-6 flex items-center justify-center text-white shadow-lg"
                          style={{ 
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                          }}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="text-right">
                        <span className="block font-bold text-black">{item.product.name}</span>
                        <span className="text-black text-sm">{item.product.price.toLocaleString()} د.ع × {item.quantity}</span>
                        {/* Display selected options */}
                        {(item.selectedSize || item.selectedColor) && (
                          <div className="flex gap-2 mt-1 justify-end">
                            {item.selectedSize && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                القياس: {item.selectedSize}
                              </span>
                            )}
                            {item.selectedColor && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                                اللون: {item.selectedColor}
                              </span>
                            )}
                          </div>
                        )}
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
                <span className="font-bold text-lg" style={{ color: '#6366f1' }}>{cartTotal.toLocaleString()} د.ع</span>
                <span className="font-bold text-black">المجموع:</span>
              </div>
            </div>
            
            {/* Customer Info Form */}
            <form onSubmit={handleSubmitOrder} className="bg-white rounded-xl shadow-sm p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right text-black">معلومات التوصيل</h2>
              
              <div className="space-y-4">
                <div className="text-right">
                  <Label htmlFor="name" className="block mb-1 text-black">الاسم</Label>
                  <Input
                    id="name"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleInputChange}
                    className="text-right text-black border-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div className="text-right">
                  <Label htmlFor="phone" className="block mb-1 text-black">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={customerInfo.phone}
                    onChange={handleInputChange}
                    className="text-right text-black border-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Governorate Selection */}
                {storeSettings.deliveryPrices && storeSettings.deliveryPrices.length > 0 && (
                  <div className="text-right">
                    <Label className="block mb-1 text-black">المحافظة</Label>
                    <Select value={selectedGovernorate} onValueChange={setSelectedGovernorate}>
                      <SelectTrigger className="text-right text-black border-2 focus:border-blue-500">
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {storeSettings.deliveryPrices.map((delivery, index) => (
                          <SelectItem key={index} value={delivery.governorate}>
                            {delivery.governorate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="text-right">
                  <Label htmlFor="address" className="block mb-1 text-black">العنوان</Label>
                  <Input
                    id="address"
                    name="address"
                    value={customerInfo.address}
                    onChange={handleInputChange}
                    className="text-right text-black border-2 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                
                 <div className="text-right">
                   <Label htmlFor="notes" className="block mb-1 text-black">ملاحظات إضافية (اختياري)</Label>
                   <Textarea
                     id="notes"
                     name="notes"
                     value={customerInfo.notes}
                     onChange={handleInputChange}
                     className="text-right text-black border-2 focus:border-blue-500 focus:ring-blue-500"
                   />
                 </div>

                 {/* Delivery Price Display */}
                 {selectedGovernorate && selectedDeliveryPrice > 0 && (
                   <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-lg" style={{ color: '#6366f1' }}>
                         {selectedDeliveryPrice.toLocaleString()} د.ع
                       </span>
                       <span className="text-black font-medium">
                         رسوم التوصيل إلى {selectedGovernorate}:
                       </span>
                     </div>
                   </div>
                 )}

                 {/* Total with Delivery */}
                 {selectedDeliveryPrice > 0 && (
                   <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-xl" style={{ color: '#6366f1' }}>
                         {totalWithDelivery.toLocaleString()} د.ع
                       </span>
                       <span className="text-black font-bold text-lg">
                         المجموع النهائي:
                       </span>
                     </div>
                   </div>
                 )}
               </div>
               
               <Button 
                 type="submit" 
                 className="w-full mt-6 text-white shadow-lg"
                 style={{ 
                   background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                   boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
                 }}
               >
                 تأكيد الطلب
               </Button>
            </form>
          </>
        )}
      </div>

      {/* Order Completion Notification */}
      {orderCompleted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-green-100 border-2 border-green-400 text-green-800 px-8 py-6 rounded-lg shadow-lg max-w-sm mx-4">
            <div className="text-center">
              <div className="text-2xl font-bold">تم الطلب</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
