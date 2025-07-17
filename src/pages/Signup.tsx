import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

const governorates = [
  "بغداد", "نينوى (الموصل)", "البصرة", "الأنبار", "ذي قار (الناصرية)",
  "السليمانية", "أربيل", "دهوك", "كركوك", "ديالى", "صلاح الدين",
  "واسط (الكوت)", "بابل (الحلة)", "النجف", "كربلاء", "المثنى (السماوة)",
  "ميسان (العمارة)", "القادسية (الديوانية)"
];

const Signup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedPlan = location.state?.selectedPlan;
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    governorate: "",
    whatsapp: "",
    verificationCode: ""
  });
  
  const [step, setStep] = useState(1); // 1: form, 2: verification
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sendVerificationCode = async () => {
    setIsLoading(true);
    // Simulate sending WhatsApp message
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
      // In real implementation, send WhatsApp message with verification code
      console.log(`Sending WhatsApp to ${formData.whatsapp}: Your verification code is: 1234`);
    }, 2000);
  };

  const verifyCode = async () => {
    setIsLoading(true);
    // Simulate verification
    setTimeout(() => {
      setIsLoading(false);
      // Redirect to dashboard or success page
      navigate('/builder');
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      sendVerificationCode();
    } else {
      verifyCode();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center py-8">
            <CardTitle className="text-2xl font-bold">
              {step === 1 ? "إنشاء حساب جديد" : "تأكيد رقم الواتساب"}
            </CardTitle>
            {selectedPlan && (
              <div className="mt-4 bg-white/20 rounded-full px-4 py-2 inline-block">
                <span className="text-sm">الباقة المختارة: {selectedPlan.name}</span>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-right text-gray-700 font-medium">الاسم الأول</Label>
                      <Input
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="text-right rounded-xl border-gray-200"
                        placeholder="أدخل الاسم الأول"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-right text-gray-700 font-medium">الاسم الثاني</Label>
                      <Input
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="text-right rounded-xl border-gray-200"
                        placeholder="أدخل الاسم الثاني"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-right text-gray-700 font-medium">المحافظة</Label>
                    <Select onValueChange={(value) => handleInputChange('governorate', value)} required>
                      <SelectTrigger className="text-right rounded-xl border-gray-200">
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {governorates.map((gov) => (
                          <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-right text-gray-700 font-medium">رقم الواتساب</Label>
                    <Input
                      value={formData.whatsapp}
                      onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                      className="text-right rounded-xl border-gray-200"
                      placeholder="مثال: 07XX-XXX-XXXX"
                      type="tel"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="text-gray-600">
                    تم إرسال كود التأكيد إلى رقم الواتساب
                    <div className="font-bold text-purple-600 mt-2">{formData.whatsapp}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium">كود التأكيد</Label>
                    <Input
                      value={formData.verificationCode}
                      onChange={(e) => handleInputChange('verificationCode', e.target.value)}
                      className="text-center rounded-xl border-gray-200 text-2xl tracking-widest"
                      placeholder="0000"
                      maxLength={4}
                      required
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-full rounded-xl"
                  >
                    <ArrowRight className="w-4 h-4 ml-2" />
                    العودة لتعديل البيانات
                  </Button>
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 text-lg font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {step === 1 ? "جاري الإرسال..." : "جاري التحقق..."}
                  </div>
                ) : (
                  step === 1 ? "إرسال كود التأكيد" : "تأكيد الرقم"
                )}
              </Button>
            </form>
            
            {step === 1 && (
              <div className="text-center mt-6 text-sm text-gray-500">
                بالمتابعة، أنت توافق على شروط الخدمة وسياسة الخصوصية
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;