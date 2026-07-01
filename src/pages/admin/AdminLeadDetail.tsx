import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MessageCircle, Copy, ArrowRight, KeyRound, ClipboardList } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import LeadAccessCodePanel from '@/components/admin/LeadAccessCodePanel';
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
  replaceLeadAccessCode,
  updateLead,
} from '@/services/leadAdminService';
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { type AccessCodeRecord, ACCESS_CODE_ERROR_MESSAGES } from '@/types/accessCodes';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { canCreateAccessCodeForLead, accessCodeBlockReason } from '@/utils/leadAccessCodeUtils';
import { saveGeneratedAccessCode, getStoredAccessCodeForLead } from '@/utils/accessCodeSessionStore';
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
  const [codesLoading, setCodesLoading] = useState(false);
  const [replacingCode, setReplacingCode] = useState(false);
  const [revealedAccessCode, setRevealedAccessCode] = useState<string | null>(null);
  const [codeDialogDeliver, setCodeDialogDeliver] = useState<{
    accessCode: string;
    codeId: string;
    meta: { planId: string; durationMonths: number; agreedPrice: number | null };
  } | null>(null);

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
    setCodesLoading(true);
    try {
      const rows = await fetchLeadAccessCodes(id);
      setCodes(rows);
      const hasPending = rows.some((c) => c.status === 'active');
      setLead((prev) => (prev ? { ...prev, has_pending_code: hasPending } : prev));
    } catch {
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    setRevealedAccessCode(null);
    setCodeDialogDeliver(null);
  }, [leadId]);

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

  const openCodeDialog = () => {
    if (!lead) return;
    const block = accessCodeBlockReason(lead);
    if (block === 'converted') {
      toast.info('العميل مُفعّل — راجع تفاصيل الطلب');
      return;
    }
    if (block === 'pending') {
      setCodeOpen(true);
      return;
    }
    if (!canCreateAccessCodeForLead(lead)) {
      toast.info('لا يمكن إنشاء رمز لهذا الطلب');
      return;
    }
    setCodeOpen(true);
  };

  const handleReplaceCode = async (): Promise<{ accessCode: string; codeId: string } | void> => {
    if (!leadId || !lead) return;
    setReplacingCode(true);
    try {
      const activeCode = codes.find((c) => c.status === 'active');
      const result = await replaceLeadAccessCode(leadId, {
        codeId: activeCode?.id,
        reason: 'replaced-by-admin: same subscription terms',
        planId: activeCode?.plan_id ?? lead.selected_plan_id ?? 'annual',
        durationMonths: activeCode?.duration_months,
        agreedPrice: activeCode?.agreed_price,
        storeName: lead.full_name,
      });
      saveGeneratedAccessCode({
        leadId,
        codeId: result.codeId,
        accessCode: result.accessCode,
        createdAt: new Date().toISOString(),
      });
      setRevealedAccessCode(result.accessCode);
      setCodeDialogDeliver({
        accessCode: result.accessCode,
        codeId: result.codeId,
        meta: {
          planId: result.planId,
          durationMonths: result.durationMonths,
          agreedPrice: result.agreedPrice,
        },
      });
      await loadCodes(leadId);
      setLead((prev) => (prev ? { ...prev, has_pending_code: true } : prev));
      setCodeOpen(true);
      toast.success('تم إنشاء الرمز — أرسله للعميل الآن');
      return { accessCode: result.accessCode, codeId: result.codeId };
    } catch (err) {
      const code = err instanceof Error ? err.message : 'replace_failed';
      toast.error(ACCESS_CODE_ERROR_MESSAGES[code] || 'تعذر استبدال الرمز');
    } finally {
      setReplacingCode(false);
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

  const activeCodeRecord = codes.find((c) => c.status === 'active') ?? null;
  const canManageCode =
    !lead.converted_user_id && (lead.has_pending_code || activeCodeRecord != null);

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
            {canCreateAccessCodeForLead(lead) && (
              <Button
                size="lg"
                className="rounded-xl gap-2 w-full sm:w-auto sm:min-w-[200px]"
                onClick={openCodeDialog}
              >
                <KeyRound className="w-5 h-5" />
                إنشاء رمز دخول
              </Button>
            )}
            {canManageCode && (
              <Button
                size="lg"
                variant={activeCodeRecord && !getStoredAccessCodeForLead(lead.id, activeCodeRecord.id) ? 'default' : 'outline'}
                className={cn(
                  'rounded-xl gap-2 w-full sm:w-auto',
                  activeCodeRecord &&
                    !getStoredAccessCodeForLead(lead.id, activeCodeRecord.id) &&
                    'bg-amber-600 hover:bg-amber-700 text-white'
                )}
                onClick={() => setCodeOpen(true)}
              >
                <KeyRound className="w-5 h-5" />
                {activeCodeRecord &&
                !getStoredAccessCodeForLead(lead.id, activeCodeRecord.id)
                  ? 'إنشاء رمز جديد للعميل'
                  : 'إدارة الرمز'}
              </Button>
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

        <LeadAccessCodePanel
          lead={lead}
          codes={codes}
          codesLoading={codesLoading}
          replacing={replacingCode}
          revealedAccessCode={revealedAccessCode}
          onRefreshCodes={() => leadId && void loadCodes(leadId)}
          onManageCode={canManageCode ? () => setCodeOpen(true) : undefined}
          onReplaceCode={canManageCode ? handleReplaceCode : undefined}
        />

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
        onOpenChange={(open) => {
          setCodeOpen(open);
          if (!open) setCodeDialogDeliver(null);
        }}
        activeCode={activeCodeRecord}
        initialDeliver={codeDialogDeliver}
        onGenerated={({ accessCode, codeId }) => {
          setRevealedAccessCode(accessCode);
          setLead((prev) =>
            prev ? { ...prev, has_pending_code: true, status: prev.status === 'new' ? 'interested' : prev.status } : prev
          );
          void refreshAfterCode();
        }}
      />
    </AdminLayout>
  );
};

export default AdminLeadDetail;
