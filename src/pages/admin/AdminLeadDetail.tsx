import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageCircle, Copy, ArrowRight, UserPlus } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  convertLeadToCustomer,
  fetchLeadById,
  updateLead,
} from '@/services/leadAdminService';
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { toast } from 'sonner';

const AdminLeadDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
    email: '',
    username: '',
    password: '',
    storeName: '',
    planName: 'standard',
    endDate: '',
  });
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    void (async () => {
      setLoading(true);
      const data = await fetchLeadById(leadId);
      if (!data) {
        toast.error('الطلب غير موجود');
        navigate('/admin/leads');
        return;
      }
      setLead(data);
      setNotes(data.notes || '');
      setStatus(data.status);
      if (!data.admin_read_at) {
        await updateLead(leadId, { markRead: true });
      }
      setLoading(false);
    })();
  }, [leadId, navigate]);

  const saveNotes = async () => {
    if (!leadId) return;
    setSaving(true);
    try {
      await updateLead(leadId, { notes, status });
      toast.success('تم الحفظ');
    } catch {
      toast.error('تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!leadId) return;
    setConverting(true);
    try {
      const result = await convertLeadToCustomer({
        leadId,
        email: convertForm.email,
        username: convertForm.username,
        password: convertForm.password,
        storeName: convertForm.storeName || lead?.full_name,
        planName: convertForm.planName,
        endDate: convertForm.endDate || null,
      });
      toast.success(`تم إنشاء حساب ${result.username}`);
      setConvertOpen(false);
      navigate('/admin/leads');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل التحويل');
    } finally {
      setConverting(false);
    }
  };

  if (loading || !lead) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-muted-foreground">جاري التحميل...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="تفاصيل الطلب">
      <div className="space-y-6 max-w-2xl">
        <Button
          variant="ghost"
          className="rounded-xl gap-2 -mr-2"
          onClick={() => navigate('/admin/leads')}
        >
          <ArrowRight className="w-4 h-4" />
          العودة للقائمة
        </Button>

        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{lead.full_name}</h2>
              <p className="text-sm text-muted-foreground mt-1" dir="ltr">
                {lead.whatsapp_number}
              </p>
            </div>
            <Badge>{LEAD_STATUS_LABELS[lead.status]}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {format(new Date(lead.created_at), 'EEEE dd MMMM yyyy، HH:mm', { locale: ar })}
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={buildWhatsAppUrl(lead.whatsapp_number, `مرحباً ${lead.full_name}`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white">
                <MessageCircle className="w-4 h-4" />
                فتح واتساب
              </Button>
            </a>
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(lead.whatsapp_number);
                toast.success('تم نسخ الرقم');
              }}
            >
              <Copy className="w-4 h-4" />
              نسخ الرقم
            </Button>
            {lead.status !== 'customer' && (
              <Button className="rounded-xl gap-2" onClick={() => setConvertOpen(true)}>
                <UserPlus className="w-4 h-4" />
                تحويل إلى عميل
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="rounded-xl font-arabic"
              placeholder="ملاحظات محادثة المبيعات..."
            />
          </div>
          <Button onClick={() => void saveNotes()} disabled={saving} className="rounded-xl">
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="font-arabic max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحويل إلى عميل</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={convertForm.email}
                onChange={(e) => setConvertForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>اسم المستخدم</Label>
              <Input
                value={convertForm.username}
                onChange={(e) => setConvertForm((f) => ({ ...f, username: e.target.value }))}
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>كلمة المرور المؤقتة</Label>
              <Input
                type="password"
                value={convertForm.password}
                onChange={(e) => setConvertForm((f) => ({ ...f, password: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>اسم المتجر</Label>
              <Input
                value={convertForm.storeName}
                onChange={(e) => setConvertForm((f) => ({ ...f, storeName: e.target.value }))}
                placeholder={lead.full_name}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>اسم الباقة</Label>
              <Input
                value={convertForm.planName}
                onChange={(e) => setConvertForm((f) => ({ ...f, planName: e.target.value }))}
                placeholder="standard / elite / annual"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label>تاريخ انتهاء الاشتراك (اختياري)</Label>
              <Input
                type="date"
                value={convertForm.endDate}
                onChange={(e) => setConvertForm((f) => ({ ...f, endDate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)} className="rounded-xl">
              إلغاء
            </Button>
            <Button onClick={() => void handleConvert()} disabled={converting} className="rounded-xl">
              {converting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminLeadDetail;
