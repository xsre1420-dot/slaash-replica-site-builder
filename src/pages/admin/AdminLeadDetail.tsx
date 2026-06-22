import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageCircle, Copy, ArrowRight, KeyRound } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchLeadAccessCodes,
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
import { type AccessCodeRecord } from '@/types/accessCodes';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { canCreateAccessCodeForLead } from '@/utils/leadAccessCodeUtils';
import { toast } from 'sonner';

const AdminLeadDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [codes, setCodes] = useState<AccessCodeRecord[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const loadLead = async (id: string) => {
    const data = await fetchLeadById(id);
    if (!data) {
      toast.error('الطلب غير موجود');
      navigate('/admin/leads');
      return null;
    }
    setLead(data);
    setNotes(data.notes || '');
    setStatus(data.status);
    if (!data.admin_read_at) {
      await updateLead(id, { markRead: true });
    }
    return data;
  };

  useEffect(() => {
    if (!leadId) return;
    void (async () => {
      setLoading(true);
      await loadLead(leadId);
      try {
        const rows = await fetchLeadAccessCodes(leadId);
        setCodes(rows);
      } catch {
        setCodes([]);
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

  const refreshCodes = async () => {
    if (!leadId) return;
    try {
      const rows = await fetchLeadAccessCodes(leadId);
      setCodes(rows);
      setLead((prev) => (prev ? { ...prev, status: 'interested' } : prev));
    } catch {
      setCodes([]);
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

          {lead.selected_plan_name && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <span className="text-muted-foreground">الباقة المطلوبة: </span>
              <span className="font-semibold text-foreground">{lead.selected_plan_name}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {lead.governorate && (
              <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">المحافظة</p>
                <p className="font-medium">{lead.governorate}</p>
              </div>
            )}
            {lead.expected_monthly_orders && (
              <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">الطلبات الشهرية</p>
                <p className="font-medium">{getMonthlyOrderLabel(lead.expected_monthly_orders)}</p>
              </div>
            )}
            {lead.instagram_url && (
              <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">إنستغرام</p>
                <a
                  href={
                    lead.instagram_url.startsWith('http')
                      ? lead.instagram_url
                      : `https://instagram.com/${lead.instagram_url.replace(/^@/, '')}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline break-all"
                  dir="ltr"
                >
                  {lead.instagram_url}
                </a>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {format(new Date(lead.created_at), 'EEEE dd MMMM yyyy، HH:mm', { locale: ar })}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canCreateAccessCodeForLead(lead) ? (
              <Button
                size="lg"
                className="rounded-xl gap-2 w-full sm:w-auto sm:min-w-[200px]"
                onClick={() => setCodeOpen(true)}
              >
                <KeyRound className="w-5 h-5" />
                إنشاء رمز دخول
              </Button>
            ) : (
              <Badge variant="outline" className="self-start px-3 py-2">
                العميل مُفعّل — لا يمكن إنشاء رمز جديد
              </Badge>
            )}
            <a
              href={buildWhatsAppUrl(lead.whatsapp_number, `مرحباً ${lead.full_name}، بخصوص طلب الاشتراك في بداية`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" className="rounded-xl gap-2 w-full sm:w-auto bg-[#25D366]/5 text-[#128C7E] border-[#25D366]/30">
                <MessageCircle className="w-4 h-4" />
                تواصل واتساب
              </Button>
            </a>
            <Button
              variant="outline"
              className="rounded-xl gap-2 w-full sm:w-auto"
              onClick={() => {
                void navigator.clipboard.writeText(lead.whatsapp_number);
                toast.success('تم نسخ الرقم');
              }}
            >
              <Copy className="w-4 h-4" />
              نسخ الرقم
            </Button>
          </div>
        </div>

        {codes.length > 0 && (
          <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-3">
            <h3 className="font-semibold">رموز الدخول</h3>
            {codes.map((code) => (
              <div
                key={code.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono font-semibold" dir="ltr">
                    BDY-****-{code.code_hint}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {code.plan_id === 'yearly' ? 'سنة' : '6 أشهر'}
                    {code.agreed_price ? ` · ${code.agreed_price.toLocaleString('ar-IQ')} د.ع` : ''}
                    {' · '}
                    {code.status === 'redeemed' ? 'مُفعّل' : code.status === 'active' ? 'بانتظار التفعيل' : code.status}
                  </p>
                </div>
                {code.subscription_end_at && (
                  <p className="text-xs text-muted-foreground">
                    ينتهي {format(new Date(code.subscription_end_at), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

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
              placeholder="ملاحظات محادثة المبيعات — السعر المتفق عليه، موعد التفعيل..."
            />
          </div>
          <Button onClick={() => void saveNotes()} disabled={saving} className="rounded-xl">
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      <GenerateAccessCodeDialog
        lead={lead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onGenerated={() => void refreshCodes()}
      />
    </AdminLayout>
  );
};

export default AdminLeadDetail;
