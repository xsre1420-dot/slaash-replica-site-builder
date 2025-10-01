import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Plus, Edit, Trash2, Tag, Settings, TrendingUp, Gift, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  description: string;
}

interface MarketingSettings {
  meta_pixel_id: string;
  facebook_access_token: string;
  google_analytics_id: string;
  marketing_enabled: boolean;
  email_marketing_enabled: boolean;
  sms_marketing_enabled: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  discount_type?: 'none' | 'percentage' | 'amount';
  discount_value?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  original_price?: number;
}

const Marketing = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    discount_type: 'none' as 'none' | 'percentage' | 'amount',
    discount_value: 0,
    discount_start_date: new Date(),
    discount_end_date: null as Date | null,
  });
  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings>({
    meta_pixel_id: '',
    facebook_access_token: '',
    google_analytics_id: '',
    marketing_enabled: false,
    email_marketing_enabled: false,
    sms_marketing_enabled: false
  });
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [isEditCouponOpen, setIsEditCouponOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 0,
    minimum_order_amount: 0,
    usage_limit: null as number | null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadCoupons();
    loadMarketingSettings();
    loadProducts();
  }, [user]);

  const loadCoupons = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('marketing_coupons')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading coupons:', error);
      return;
    }

    setCoupons((data || []) as Coupon[]);
  };

  const loadMarketingSettings = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('marketing_settings')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (data) {
      setMarketingSettings({
        meta_pixel_id: data.meta_pixel_id || '',
        facebook_access_token: data.facebook_access_token || '',
        google_analytics_id: data.google_analytics_id || '',
        marketing_enabled: data.marketing_enabled || false,
        email_marketing_enabled: data.email_marketing_enabled || false,
        sms_marketing_enabled: data.sms_marketing_enabled || false
      });
    }
  };

  const loadProducts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, image_url, category, discount_type, discount_value, discount_start_date, discount_end_date, original_price')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading products:', error);
      return;
    }

    setProducts((data || []) as Product[]);
  };

  const openDiscountDialog = (product: Product) => {
    setSelectedProduct(product);
    setDiscountForm({
      discount_type: (product.discount_type as 'none' | 'percentage' | 'amount') || 'none',
      discount_value: product.discount_value || 0,
      discount_start_date: product.discount_start_date ? new Date(product.discount_start_date) : new Date(),
      discount_end_date: product.discount_end_date ? new Date(product.discount_end_date) : null,
    });
    setIsDiscountDialogOpen(true);
  };

  const saveProductDiscount = async () => {
    if (!selectedProduct || !user) return;

    setLoading(true);

    // Calculate new price based on discount
    let newPrice = selectedProduct.price;
    const originalPrice = selectedProduct.original_price || selectedProduct.price;
    
    if (discountForm.discount_type !== 'none') {
      if (discountForm.discount_type === 'percentage') {
        newPrice = originalPrice * (1 - discountForm.discount_value / 100);
      } else {
        newPrice = originalPrice - discountForm.discount_value;
      }
    } else {
      // Removing discount, restore original price
      newPrice = originalPrice;
    }

    const updateData: any = {
      discount_type: discountForm.discount_type,
      discount_value: discountForm.discount_value,
      discount_start_date: discountForm.discount_start_date.toISOString(),
      discount_end_date: discountForm.discount_end_date ? discountForm.discount_end_date.toISOString() : null,
      price: newPrice,
    };

    // If adding discount for first time, save original price
    if (discountForm.discount_type !== 'none' && !selectedProduct.original_price) {
      updateData.original_price = originalPrice;
    }

    // If removing discount, clear original price
    if (discountForm.discount_type === 'none' && selectedProduct.original_price) {
      updateData.original_price = null;
    }

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', selectedProduct.id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث الخصم",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم بنجاح",
        description: discountForm.discount_type === 'none' ? "تم إزالة الخصم" : "تم حفظ الخصم"
      });
      loadProducts();
      setIsDiscountDialogOpen(false);
      setSelectedProduct(null);
    }

    setLoading(false);
  };

  const handleAddCoupon = async () => {
    if (!user || !newCoupon.code.trim() || !newCoupon.discount_value) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال جميع البيانات المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('marketing_coupons')
      .insert({
        owner_id: user.id,
        code: newCoupon.code.toUpperCase(),
        discount_type: newCoupon.discount_type,
        discount_value: newCoupon.discount_value,
        minimum_order_amount: newCoupon.minimum_order_amount,
        usage_limit: newCoupon.usage_limit,
        start_date: new Date(newCoupon.start_date).toISOString(),
        end_date: newCoupon.end_date ? new Date(newCoupon.end_date).toISOString() : null,
        description: newCoupon.description,
        is_active: true,
        used_count: 0
      });

    if (error) {
      toast({
        title: "خطأ",
        description: error.message.includes('duplicate') ? "كود الكوبون موجود مسبقاً" : "فشل في إضافة الكوبون",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم بنجاح",
        description: "تمت إضافة الكوبون الجديد"
      });
      loadCoupons();
      setIsAddCouponOpen(false);
      setNewCoupon({
        code: '',
        discount_type: 'percentage',
        discount_value: 0,
        minimum_order_amount: 0,
        usage_limit: null,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        description: ''
      });
    }

    setLoading(false);
  };

  const handleDeleteCoupon = async (id: string) => {
    const { error } = await supabase
      .from('marketing_coupons')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف الكوبون",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم بنجاح",
        description: "تم حذف الكوبون"
      });
      loadCoupons();
    }
  };

  const handleToggleCouponStatus = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('marketing_coupons')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (!error) {
      loadCoupons();
      toast({
        title: "تم التحديث",
        description: `تم ${!isActive ? 'تفعيل' : 'إيقاف'} الكوبون`
      });
    }
  };

  const saveMarketingSettings = async () => {
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('marketing_settings')
      .upsert({
        owner_id: user.id,
        ...marketingSettings
      });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ الإعدادات",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات التسويق بنجاح"
      });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-black">التسويق والعروض</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="coupons" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="coupons" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              كوبونات الخصم
            </TabsTrigger>
            <TabsTrigger value="product-discounts" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              خصومات المنتجات
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              إعدادات التسويق
            </TabsTrigger>
          </TabsList>

          {/* Coupons Tab */}
          <TabsContent value="coupons" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <Button
                    onClick={() => setIsAddCouponOpen(true)}
                    className="text-white rounded-2xl px-6"
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة كوبون جديد
                  </Button>
                  <CardTitle className="text-right">إدارة الكوبونات</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {coupons.length === 0 ? (
                  <div className="text-center py-12">
                    <Gift className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-500 mb-2">لا توجد كوبونات بعد</h3>
                    <p className="text-gray-400 mb-6">ابدأ بإنشاء كوبونات خصم لعملائك</p>
                    <Button
                      onClick={() => setIsAddCouponOpen(true)}
                      variant="outline"
                      className="rounded-2xl"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة كوبون
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {coupons.map((coupon) => (
                      <div key={coupon.id} className="border rounded-xl p-4 bg-white">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={coupon.is_active}
                              onCheckedChange={() => handleToggleCouponStatus(coupon.id, coupon.is_active)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={coupon.is_active ? "default" : "secondary"}>
                                {coupon.is_active ? "مفعل" : "موقف"}
                              </Badge>
                              <code className="text-lg font-bold bg-gray-100 px-2 py-1 rounded">
                                {coupon.code}
                              </code>
                            </div>
                            <p className="text-sm text-gray-600">{coupon.description}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-right">
                            <span className="text-gray-500 block">قيمة الخصم</span>
                            <span className="font-medium">
                              {coupon.discount_type === 'percentage' 
                                ? `${coupon.discount_value}%`
                                : `${coupon.discount_value.toLocaleString()} د.ع`
                              }
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block">الحد الأدنى للطلب</span>
                            <span className="font-medium">{coupon.minimum_order_amount.toLocaleString()} د.ع</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block">مرات الاستخدام</span>
                            <span className="font-medium">
                              {coupon.used_count} / {coupon.usage_limit || '∞'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 block">تاريخ الانتهاء</span>
                            <span className="font-medium">
                              {coupon.end_date 
                                ? new Date(coupon.end_date).toLocaleDateString('ar-SA')
                                : 'بلا انتهاء'
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Product Discounts Tab */}
          <TabsContent value="product-discounts" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <Button
                    onClick={() => {
                      setSelectedProduct(null);
                      setDiscountForm({
                        discount_type: 'percentage',
                        discount_value: 0,
                        discount_start_date: new Date(),
                        discount_end_date: null,
                      });
                      setIsDiscountDialogOpen(true);
                    }}
                    className="text-white rounded-2xl px-6"
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة خصم على منتج
                  </Button>
                  <CardTitle className="text-right">خصومات المنتجات</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {products.filter(p => p.discount_type && p.discount_type !== 'none').length === 0 ? (
                  <div className="text-center py-12">
                    <Tag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-500 mb-2">لا توجد خصومات على المنتجات</h3>
                    <p className="text-gray-400 mb-6">ابدأ بإضافة خصم على منتج معين</p>
                    <Button
                      onClick={() => {
                        setSelectedProduct(null);
                        setDiscountForm({
                          discount_type: 'percentage',
                          discount_value: 0,
                          discount_start_date: new Date(),
                          discount_end_date: null,
                        });
                        setIsDiscountDialogOpen(true);
                      }}
                      variant="outline"
                      className="rounded-2xl"
                    >
                      <Plus className="w-4 h-4 ml-2" />
                      إضافة خصم
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {products
                      .filter(product => product.discount_type && product.discount_type !== 'none')
                      .map((product) => (
                        <div 
                          key={product.id} 
                          className="border rounded-2xl bg-white overflow-hidden hover:shadow-lg transition-shadow"
                        >
                          <div className="flex flex-row-reverse items-stretch">
                            {/* Product Image Section */}
                            <div className="relative w-48 flex-shrink-0">
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                  <Tag className="w-12 h-12 text-gray-400" />
                                </div>
                              )}
                              
                              {/* Discount Badge */}
                              <div className="absolute top-3 left-3">
                                <Badge className="bg-red-500 text-white px-3 py-1 text-sm font-bold rounded-full shadow-lg">
                                  {product.discount_type === 'percentage' 
                                    ? `خصم ${product.discount_value}%`
                                    : `خصم ${product.discount_value?.toLocaleString()} د.ع`
                                  }
                                </Badge>
                              </div>
                            </div>

                            {/* Product Info Section */}
                            <div className="flex-1 p-5 flex flex-col justify-between">
                              <div className="text-right">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedProduct(product);
                                        setDiscountForm({
                                          discount_type: 'none',
                                          discount_value: 0,
                                          discount_start_date: new Date(),
                                          discount_end_date: null,
                                        });
                                        saveProductDiscount();
                                      }}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full h-8 w-8 p-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDiscountDialog(product)}
                                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full h-8 w-8 p-0"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  
                                  <div>
                                    <h3 className="font-bold text-xl mb-1">{product.name}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      {product.category}
                                    </p>
                                  </div>
                                </div>

                                {/* Pricing Info */}
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                                  <div className="space-y-3 mb-4">
                                    {/* Original Price */}
                                    <div className="text-right flex items-center justify-end gap-2">
                                      <span className="text-sm text-gray-600">:</span>
                                      <p className="text-lg font-semibold line-through text-gray-400">
                                        {(product.original_price || product.price).toLocaleString()}
                                        <span className="text-xs mr-1">د.ع</span>
                                      </p>
                                      <span className="text-sm text-gray-600">السعر الأصلي</span>
                                    </div>
                                    
                                    {/* Discounted Price */}
                                    <div className="text-right flex items-center justify-end gap-2">
                                      <span className="text-sm text-gray-700 font-semibold">:</span>
                                      <p className="text-lg font-bold text-gray-900">
                                        {product.price.toLocaleString()}
                                        <span className="text-xs mr-1">د.ع</span>
                                      </p>
                                      <span className="text-sm text-gray-700 font-semibold">السعر بعد الخصم</span>
                                    </div>
                                  </div>
                                  
                                  {/* Savings and Validity */}
                                  <div className="pt-3 border-t border-gray-200">
                                    <div className="flex justify-between items-center text-xs text-gray-600">
                                      <div className="flex items-center gap-1">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        <span>
                                          صالح حتى: {product.discount_end_date 
                                            ? (() => {
                                                const date = new Date(product.discount_end_date);
                                                const day = String(date.getDate()).padStart(2, '0');
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const year = date.getFullYear();
                                                return `${day}/${month}/${year}`;
                                              })()
                                            : 'غير محدد'
                                          }
                                        </span>
                                      </div>
                                      <span className="font-semibold">
                                        وفّر {((product.original_price || product.price) - product.price).toLocaleString()} د.ع
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketing Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-right">إعدادات Meta Pixel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="metaPixelId" className="text-right block">Meta Pixel ID</Label>
                  <Input
                    id="metaPixelId"
                    placeholder="أدخل Meta Pixel ID"
                    value={marketingSettings.meta_pixel_id}
                    onChange={(e) => setMarketingSettings(prev => ({ ...prev, meta_pixel_id: e.target.value }))}
                    className="text-right rounded-2xl"
                  />
                  <p className="text-sm text-gray-500 text-right">
                    يمكنك العثور على Pixel ID في إعدادات Meta Business Manager
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="googleAnalytics" className="text-right block">Google Analytics ID</Label>
                  <Input
                    id="googleAnalytics"
                    placeholder="G-XXXXXXXXXX"
                    value={marketingSettings.google_analytics_id}
                    onChange={(e) => setMarketingSettings(prev => ({ ...prev, google_analytics_id: e.target.value }))}
                    className="text-right rounded-2xl"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-xl">
                  <Switch
                    checked={marketingSettings.marketing_enabled}
                    onCheckedChange={(checked) => setMarketingSettings(prev => ({ ...prev, marketing_enabled: checked }))}
                  />
                  <div className="text-right">
                    <Label>تفعيل التتبع التسويقي</Label>
                    <p className="text-sm text-gray-500">تفعيل Meta Pixel و Google Analytics</p>
                  </div>
                </div>

                <Button
                  onClick={saveMarketingSettings}
                  disabled={loading}
                  className="w-full text-white rounded-2xl"
                  style={{ 
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                  }}
                >
                  {loading ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Coupon Dialog */}
      <Dialog open={isAddCouponOpen} onOpenChange={setIsAddCouponOpen}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">إضافة كوبون خصم جديد</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>كود الكوبون</Label>
              <Input
                placeholder="مثل: DISCOUNT20"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="text-right rounded-2xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>قيمة الخصم</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={newCoupon.discount_value || ''}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                  className="text-right rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>نوع الخصم</Label>
                <Select 
                  value={newCoupon.discount_type} 
                  onValueChange={(value: 'percentage' | 'fixed_amount') => 
                    setNewCoupon(prev => ({ ...prev, discount_type: value }))
                  }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                    <SelectItem value="fixed_amount">مبلغ ثابت (د.ع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>حد الاستخدام (اختياري)</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newCoupon.usage_limit || ''}
                  onChange={(e) => setNewCoupon(prev => ({ 
                    ...prev, 
                    usage_limit: e.target.value ? Number(e.target.value) : null 
                  }))}
                  className="text-right rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للطلب</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newCoupon.minimum_order_amount || 0}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, minimum_order_amount: Number(e.target.value) }))}
                  className="text-right rounded-2xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الانتهاء (اختياري)</Label>
                <Input
                  type="date"
                  value={newCoupon.end_date}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, end_date: e.target.value }))}
                  className="text-right rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input
                  type="date"
                  value={newCoupon.start_date}
                  onChange={(e) => setNewCoupon(prev => ({ ...prev, start_date: e.target.value }))}
                  className="text-right rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>وصف الكوبون</Label>
              <Textarea
                placeholder="خصم 20% على جميع المنتجات"
                value={newCoupon.description}
                onChange={(e) => setNewCoupon(prev => ({ ...prev, description: e.target.value }))}
                className="text-right rounded-2xl"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAddCouponOpen(false)}
              className="rounded-2xl"
            >
              إلغاء
            </Button>
            <Button 
              onClick={handleAddCoupon}
              disabled={loading}
              className="text-white rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
            >
              {loading ? "جاري الإضافة..." : "إضافة الكوبون"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Discount Dialog */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">
              {selectedProduct ? `${selectedProduct.name} - إدارة الخصم` : 'إضافة خصم على منتج'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {!selectedProduct && (
              <div className="space-y-3">
                <Label className="text-lg font-semibold">اختر المنتج</Label>
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        // Load existing discount if any
                        if (product.discount_type && product.discount_type !== 'none') {
                          setDiscountForm({
                            discount_type: product.discount_type as 'none' | 'percentage' | 'amount',
                            discount_value: product.discount_value || 0,
                            discount_start_date: product.discount_start_date ? new Date(product.discount_start_date) : new Date(),
                            discount_end_date: product.discount_end_date ? new Date(product.discount_end_date) : null,
                          });
                        }
                      }}
                      className="flex items-center gap-4 p-3 border-2 rounded-xl cursor-pointer transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
                    >
                      {/* Product Image */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <Tag className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 text-right">
                        <h4 className="font-semibold text-base mb-1">{product.name}</h4>
                        <p className="text-sm text-gray-500 mb-1">{product.category}</p>
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-lg font-bold text-primary">
                            {product.price.toLocaleString()} د.ع
                          </span>
                          {product.discount_type && product.discount_type !== 'none' && (
                            <Badge className="bg-red-500 text-white text-xs">
                              يوجد خصم
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProduct && (
              <>
                {/* Selected Product Info */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white shadow-sm">
                      {selectedProduct.image_url ? (
                        <img 
                          src={selectedProduct.image_url} 
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <Tag className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <h3 className="font-bold text-lg mb-1">{selectedProduct.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{selectedProduct.category}</p>
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="secondary" className="text-xs">
                          السعر: {(selectedProduct.original_price || selectedProduct.price).toLocaleString()} د.ع
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>نوع الخصم</Label>
                  <Select 
                    value={discountForm.discount_type} 
                    onValueChange={(value: 'none' | 'percentage' | 'amount') => 
                      setDiscountForm(prev => ({ ...prev, discount_type: value }))
                    }
                  >
                    <SelectTrigger className="rounded-2xl text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون خصم</SelectItem>
                      <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                      <SelectItem value="amount">مبلغ ثابت (د.ع)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {discountForm.discount_type !== 'none' && (
                  <>
                    <div className="space-y-2">
                      <Label>قيمة الخصم</Label>
                      <Input
                        type="number"
                        placeholder={discountForm.discount_type === 'percentage' ? '10' : '5000'}
                        value={discountForm.discount_value || ''}
                        onChange={(e) => setDiscountForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                        className="text-right rounded-2xl"
                      />
                    </div>

                <div className="space-y-2">
                  <Label>تاريخ بدء الخصم</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal rounded-2xl",
                          !discountForm.discount_start_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {discountForm.discount_start_date ? format(discountForm.discount_start_date, "dd/MM/yyyy") : <span>اختر التاريخ</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={discountForm.discount_start_date}
                        onSelect={(date) => date && setDiscountForm(prev => ({ ...prev, discount_start_date: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>تاريخ انتهاء الخصم (اختياري)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right font-normal rounded-2xl",
                          !discountForm.discount_end_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {discountForm.discount_end_date ? format(discountForm.discount_end_date, "dd/MM/yyyy") : <span>بلا تاريخ انتهاء</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={discountForm.discount_end_date || undefined}
                        onSelect={(date) => setDiscountForm(prev => ({ ...prev, discount_end_date: date || null }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedProduct && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-center text-right">
                      <div>
                        <div className="text-gray-600">السعر بعد الخصم:</div>
                        <div className="text-xl font-bold text-blue-600">
                          {discountForm.discount_type === 'percentage' 
                            ? ((selectedProduct.original_price || selectedProduct.price) * (1 - discountForm.discount_value / 100)).toLocaleString()
                            : ((selectedProduct.original_price || selectedProduct.price) - discountForm.discount_value).toLocaleString()
                          } د.ع
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">السعر الأصلي:</div>
                        <div className="text-lg line-through text-gray-500">
                          {(selectedProduct.original_price || selectedProduct.price).toLocaleString()} د.ع
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                  </>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDiscountDialogOpen(false);
                setSelectedProduct(null);
              }}
              className="rounded-2xl"
            >
              إلغاء
            </Button>
            {selectedProduct && (
              <Button 
                onClick={saveProductDiscount}
                disabled={loading}
                className="text-white rounded-2xl"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                }}
              >
                {loading ? "جاري الحفظ..." : discountForm.discount_type === 'none' ? 'إزالة الخصم' : 'حفظ الخصم'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketing;