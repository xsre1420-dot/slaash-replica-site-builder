import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageCircle, Copy, ArrowRight, KeyRound, ClipboardList } from 'lucide-react';
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
  markLeadContacted,
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
import {
  LEAD_STATUS_COLORS,
  buildFollowUpWhatsAppMessage,
  buildInitialWhatsAppMessage,
  buildLeadSummaryText,
  formatLeadRelativeTime,
} from '@/utils/leadWorkflowUtils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const QUICK_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'customer', 'rejected'];

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
      setLead({ ...data, admin_read_at: new Date().toISOString(), is_unread: false });
    }
    return data;
  };

  const loadCodes = async (id: string) => {
    try {
      const rows = await fetchLeadAccessCodes(id);
      setCodes(rows);
      const hasPending = rows.some((c) => c.status === 'active');
      setLead((prev) => (prev ? { ...prev, has_pending_code: hasPending } : prev));
    } catch {
      setCodes([]);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    void (async () => {
      setLoading(true);
      await loadLead(leadId);
      await loadCodes(leadId);
      setLoading(false);
    })();
  }, [leadId, navigate]);

  const saveNotes = async (nextStatus?: LeadStatus) => {
    if (!leadId) return;
    setSaving(true);
    const statusToSave = nextStatus ?? status;
    try {
      await updateLead(leadId, { notes, status: statusToSave });
      setStatus(statusToSave);
      setLead((prev) => (prev ? { ...prev, notes, status: statusToSave } : prev));
      toast.success('تم الحفظ');
    } catch {
      toast.error('تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = async (message: string) => {
    if (!lead) return;
    if (lead.status === 'new') {
      try {
        await markLeadContacted(lead.id);
        setLead({ ...lead, status: 'contacted', is_unread: false });
        setStatus('contacted');
      } catch {
        /* continue */
      }
    }
    window.open(buildWhatsAppUrl(lead.whatsapp_number, message), '_blank');
  };

  const refreshAfterCode = async () => {
    if (!leadId) return;
    await loadCodes(leadId);
    const data = await fetchLeadById(leadId);
    if (data) {
      setLead(data);
      setStatus(data.status);
    }
  };

  if (loading || !lead) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-muted-foreground">جاري التحميل...</div>
      </AdminLayout>
    );
  }

  const whatsAppMessage =
    lead.status === 'contacted' || lead.status === 'interested'
      ? buildFollowUpWhatsAppMessage(lead)
      : buildInitialWhatsAppMessage(lead);

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
              <p className="text-sm text-muted-foreground mt-1 font-mono" dir="ltr">
                {lead.whatsapp_number}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatLeadRelativeTime(lead.created_at)} ·{' '}
                {format(new Date(lead.created_at), 'EEEE dd MMMM yyyy، HH:mm', { locale: ar })}
              </p>
            </div>
            <Badge variant="outline" className={cn('font-normal', LEAD_STATUS_COLORS[lead.status])}>
              {LEAD_STATUS_LABELS[lead.status]}
            </Badge>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canCreateAccessCodeForLead(lead) && !lead.has_pending_code && (
              <Button
                size="lg"
                className="rounded-xl gap-2 w-full sm:w-auto sm:min-w-[200px]"
                onClick={() => setCodeOpen(true)}
              >
                <KeyRound className="w-5 h-5" />
                إنشاء رمز دخول
              </Button>
            )}
            {lead.has_pending_code && (
              <Badge variant="outline" className="self-start px-3 py-2 text-amber-700 border-amber-500/30">
                رمز مُرسَل — بانتظار تفعيل العميل
              </Badge>
            )}
            {lead.converted_user_id && (
              <Badge variant="outline" className="self-start px-3 py-2 text-emerald-700 border-emerald-500/30">
                العميل مُفعّل
              </Badge>
            )}
            <Button
              variant="outline"
              className="rounded-xl gap-2 w-full sm:w-auto bg-[#25D366]/5 text-[#128C7E] border-[#25D366]/30"
              onClick={() => void handleWhatsApp(whatsAppMessage)}
            >
              <MessageCircle className="w-4 h-4" />
              {lead.status === 'new' ? 'تواصل واتساب' : 'متابعة واتساب'}
            </Button>
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
            <Button
              variant="outline"
              className="rounded-xl gap-2 w-full sm:w-auto"
              onClick={() => {
                void navigator.clipboard.writeText(buildLeadSummaryText(lead));
                toast.success('تم نسخ ملخص الطلب');
              }}
            >
              <ClipboardList className="w-4 h-4" />
              نسخ الملخص
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
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_STATUSES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setStatus(s)}
                >
                  {LEAD_STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
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
            <Label>ملاحظات المبيعات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="rounded-xl font-arabic"
              placeholder="السعر المتفق عليه، موعد التفعيل، اعتراضات العميل..."
            />
          </div>
          <Button onClick={() => void saveNotes()} disabled={saving} className="rounded-xl w-full sm:w-auto">
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      <GenerateAccessCodeDialog
        lead={lead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onGenerated={() => void refreshAfterCode()}
      />
    </AdminLayout>
  );
};

export default AdminLeadDetail;
