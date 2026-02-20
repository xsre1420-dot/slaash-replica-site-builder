
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  
  const selectedDeliveryPrice = selectedGovernorate 
    ? storeSettings.deliveryPrices?.find(d => d.governorate === selectedGovernorate)?.price || 0
    : 0;
  
  const totalWithDelivery = cartTotal + selectedDeliveryPrice;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!customerInfo.name.trim()) {
      errors.name = 'يرجى إدخال الاسم';
    }
    if (!customerInfo.phone.trim()) {
      errors.phone = 'يرجى إدخال رقم الهاتف';
    } else if (!/^[\d\s+()-]{7,15}$/.test(customerInfo.phone.trim())) {
      errors.phone = 'رقم الهاتف غير صحيح';
    }
    if (!customerInfo.address.trim()) {
      errors.address = 'يرجى إدخال العنوان';
    }
    if (storeSettings.deliveryPrices?.length && !selectedGovernorate) {
      errors.governorate = 'يرجى اختيار المحافظة';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    const newOrder: Order = {
      id: `ord-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      items: [...cartItems],
      customerInfo: {
        name: customerInfo.name,
        phone: customerInfo.phone,
        address: customerInfo.address,
        notes: customerInfo.notes || undefined,
        governorate: selectedGovernorate,
      },
      total: totalWithDelivery,
      date: new Date().toISOString(),
      status: 'pending',
    };
    
    const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    const updatedOrders = [newOrder, ...existingOrders];
    localStorage.setItem('orders', JSON.stringify(updatedOrders));
    
    setOrderCompleted(true);
    
    setTimeout(() => {
      setOrderCompleted(false);
      clearCart();
      navigate("/preview");
    }, 3000);
  };

  const inputClasses = (field: string) => 
    `text-right border-2 rounded-xl text-foreground bg-muted/30 focus:border-primary ${
      formErrors[field] ? 'border-destructive focus:border-destructive' : 'border-border'
    }`;

  return (
    <div className="min-h-screen bg-background relative font-arabic" dir="rtl">
      {/* Header */}
      <div className="bg-foreground text-background p-4">
        <div className="flex justify-between items-center">
          <div className="w-6" />
          <h1 className="text-xl font-bold">إتمام الطلب</h1>
          <Link to="/preview">
            <ArrowRight className="w-6 h-6 text-background" />
          </Link>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4">
        {cartItems.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border mt-4">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">سلة التسوق فارغة</h3>
            <p className="text-muted-foreground">قم بإضافة بعض المنتجات للاستمرار بالطلب</p>
            <Link to="/preview">
              <Button className="mt-6 rounded-xl">العودة للمتجر</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div className="bg-card rounded-2xl border border-border p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right text-foreground">طلبك</h2>
              <div className="space-y-4">
                {cartItems.map((item, index) => (
                  <div key={`${item.product.id}-${item.selectedSize || 'no-size'}-${item.selectedColor || 'no-color'}-${index}`} className="border-b border-border pb-4 last:border-b-0">
                    <div className="flex gap-4">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-24 h-24 rounded-xl object-cover"
                        loading="lazy"
                      />
                      <div className="flex-1 text-right">
                        <h3 className="font-bold text-foreground text-lg mb-1">{item.product.name}</h3>
                        
                        {(item.selectedSize || item.selectedColor) && (
                          <div className="flex gap-2 mb-2 justify-end flex-wrap">
                            {item.selectedSize && (
                              <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                                المقاس: {item.selectedSize}
                              </span>
                            )}
                            {item.selectedColor && (
                              <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.selectedColor }} />
                                اللون
                              </span>
                            )}
                          </div>
                        )}
                        
                        <p className="font-bold text-lg mb-3 text-foreground">
                          {(item.product.price * item.quantity).toLocaleString()} د.ع
                        </p>
                        
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor)}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          
                          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedSize, item.selectedColor)}
                              className="rounded-full w-7 h-7 flex items-center justify-center bg-foreground text-background"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-foreground font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedSize, item.selectedColor)}
                              className="rounded-full w-7 h-7 flex items-center justify-center bg-foreground text-background"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t border-border">
                <span className="font-bold text-lg text-foreground">{cartTotal.toLocaleString()} د.ع</span>
                <span className="font-bold text-foreground">المجموع:</span>
              </div>
            </div>
            
            {/* Customer Info Form */}
            <form onSubmit={handleSubmitOrder} className="bg-card rounded-2xl border border-border p-4 mt-4">
              <h2 className="text-xl font-bold mb-4 text-right text-foreground">معلومات التوصيل</h2>
              
              <div className="space-y-4">
                <FormField label="الاسم" error={formErrors.name}>
                  <Input
                    id="name"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleInputChange}
                    className={inputClasses('name')}
                    placeholder="أدخل اسمك الكامل"
                    autoComplete="name"
                  />
                </FormField>
                
                <FormField label="رقم الهاتف" error={formErrors.phone}>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={customerInfo.phone}
                    onChange={handleInputChange}
                    className={inputClasses('phone')}
                    placeholder="07xx xxx xxxx"
                    autoComplete="tel"
                    dir="ltr"
                  />
                </FormField>

                {storeSettings.deliveryPrices && storeSettings.deliveryPrices.length > 0 && (
                  <FormField label="المحافظة" error={formErrors.governorate}>
                    <Select value={selectedGovernorate} onValueChange={(v) => {
                      setSelectedGovernorate(v);
                      if (formErrors.governorate) setFormErrors(prev => ({ ...prev, governorate: '' }));
                    }}>
                      <SelectTrigger className={`text-right rounded-xl ${formErrors.governorate ? 'border-destructive' : 'border-border'}`}>
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
                  </FormField>
                )}
                
                <FormField label="العنوان" error={formErrors.address}>
                  <Input
                    id="address"
                    name="address"
                    value={customerInfo.address}
                    onChange={handleInputChange}
                    className={inputClasses('address')}
                    placeholder="أدخل عنوانك بالتفصيل"
                    autoComplete="street-address"
                  />
                </FormField>
                
                <div className="text-right">
                  <Label htmlFor="notes" className="block mb-1.5 text-foreground text-sm">ملاحظات إضافية (اختياري)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={customerInfo.notes}
                    onChange={handleInputChange}
                    className="text-right border-2 border-border rounded-xl text-foreground bg-muted/30 focus:border-primary"
                    placeholder="أي ملاحظات خاصة بالطلب"
                  />
                </div>

                {selectedGovernorate && selectedDeliveryPrice > 0 && (
                  <div className="bg-muted/50 p-4 rounded-xl border border-border">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg text-foreground">{selectedDeliveryPrice.toLocaleString()} د.ع</span>
                      <span className="text-muted-foreground font-medium">رسوم التوصيل إلى {selectedGovernorate}:</span>
                    </div>
                  </div>
                )}

                {selectedDeliveryPrice > 0 && (
                  <div className="bg-accent/50 p-4 rounded-xl border border-primary/20">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xl text-foreground">{totalWithDelivery.toLocaleString()} د.ع</span>
                      <span className="text-foreground font-bold text-lg">المجموع النهائي:</span>
                    </div>
                  </div>
                )}
              </div>
               
              <Button type="submit" className="w-full mt-6 rounded-xl py-3 text-base font-semibold">
                تأكيد الطلب
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Order Completion */}
      {orderCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-sm mx-4 animate-fade-in">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">تم تأكيد الطلب بنجاح! 🎉</h3>
            <p className="text-muted-foreground text-sm">سيتم التواصل معك قريباً لتأكيد التوصيل</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable form field with error display
const FormField = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="text-right">
    <Label className="block mb-1.5 text-foreground text-sm">{label} *</Label>
    {children}
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);

export default Checkout;
