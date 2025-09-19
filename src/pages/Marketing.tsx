import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Plus, Edit, Trash2, Tag, Settings, TrendingUp, Gift } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

const Marketing = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="coupons" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              كوبونات الخصم
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
    </div>
  );
};

export default Marketing;