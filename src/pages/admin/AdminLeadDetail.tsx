import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  MessageCircle,
  Copy,
  ArrowRight,
  ClipboardList,
  CalendarPlus,
  Package,
  MapPin,
  BarChart3,
  Instagram,
  Calendar,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import ExtendSubscriptionDialog from '@/components/admin/ExtendSubscriptionDialog';
import LeadAccessCodePanel from '@/components/admin/LeadAccessCodePanel';
import LeadCodeActionButton from '@/components/admin/LeadCodeActionButton';
import SubscriptionStatusBadge from '@/components/admin/subscription/SubscriptionStatusBadge';
import { Button } from '@/components/ui/button';
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
  fetchLeadById,
  markLeadContacted,
  updateLead,
} from '@/services/leadAdminService';
import {
  LEAD_STATUS_OPTIONS,
  LEAD_STATUS_LABELS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { useLeadAccessCodeDialog } from '@/hooks/useLeadAccessCodeDialog';
import {
  buildFollowUpWhatsAppMessage,
  buildInitialWhatsAppMessage,
  buildLeadSummaryText,
  formatLeadRelativeTime,
} from '@/utils/leadWorkflowUtils';
import { planLabelForLead } from '@/utils/subscriptionPlanLabels';
import { toast } from 'sonner';
import { isConvertedLead } from '@/utils/leadAccessCodeUtils';

const QUICK_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'customer', 'rejected'];

const AdminLeadDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadRecord | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  const {
    codeOpen,
    setCodeOpen,
    codes,
    codesLoading,
    replacingCode,
    revealedAccessCode,
    codeDialogDeliver,
    activeCodeRecord,
    canManageCode,
    canReissueCode,
    loadCodes,
    openCodeDialog,
    handleReplaceCode,
    handleReissueCode,
    handleGenerated,
    resetForLead,
  } = useLeadAccessCodeDialog({
    onLeadPatch: (_leadId, patch) => {
      setLead((prev) => (prev ? { ...prev, ...patch } : prev));
    },
  });

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

  useEffect(() => {
    if (!leadId) return;
    resetForLead();
  }, [leadId, resetForLead]);

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
    <AdminLayout title="تفاصيل طلب الاشتراك">
      <div className="space-y-5">
        <Button
          variant="ghost"
          className="rounded-xl gap-2 -mr-2"
          onClick={() => navigate('/admin/leads')}
        >
          <ArrowRight className="w-4 h-4" />
          العودة للقائمة
        </Button>

        <div className="sub-detail-grid">
          <div className="sub-detail-grid__main space-y-5">
            <div className="sub-detail-hero">
              <div className="sub-detail-hero__banner" />
              <div className="sub-detail-hero__body">
                <div className="sub-detail-hero__top">
                  <div>
                    <div className="sub-detail-hero__avatar">{lead.full_name.charAt(0)}</div>
                    <h2 className="sub-detail-hero__name">{lead.full_name}</h2>
                    <p className="sub-detail-hero__phone" dir="ltr">
                      {lead.whatsapp_number}
                    </p>
                    <p className="sub-detail-hero__date">
                      <Calendar className="inline h-3.5 w-3.5 ml-1" />
                      {formatLeadRelativeTime(lead.created_at)} ·{' '}
                      {format(new Date(lead.created_at), 'EEEE dd MMMM yyyy، HH:mm', {
                        locale: ar,
                      })}
                    </p>
                  </div>
                  <SubscriptionStatusBadge type="workflow" lead={lead} />
                </div>

                <div className="sub-detail-info-grid">
                  {lead.selected_plan_name && (
                    <div className="sub-detail-info-item">
                      <p className="sub-detail-info-item__label">
                        <Package className="inline h-3 w-3 ml-1" />
                        الباقة المطلوبة
                      </p>
                      <p className="sub-detail-info-item__value">{planLabelForLead(lead)}</p>
                    </div>
                  )}
                  {lead.governorate && (
                    <div className="sub-detail-info-item">
                      <p className="sub-detail-info-item__label">
                        <MapPin className="inline h-3 w-3 ml-1" />
                        المحافظة
                      </p>
                      <p className="sub-detail-info-item__value">{lead.governorate}</p>
                    </div>
                  )}
                  {lead.expected_monthly_orders && (
                    <div className="sub-detail-info-item">
                      <p className="sub-detail-info-item__label">
                        <BarChart3 className="inline h-3 w-3 ml-1" />
                        الطلبات الشهرية
                      </p>
                      <p className="sub-detail-info-item__value">
                        {getMonthlyOrderLabel(lead.expected_monthly_orders)}
                      </p>
                    </div>
                  )}
                  {lead.instagram_url && (
                    <div className="sub-detail-info-item sub-detail-info-item--wide">
                      <p className="sub-detail-info-item__label">
                        <Instagram className="inline h-3 w-3 ml-1" />
                        إنستغرام
                      </p>
                      <a
                        href={
                          lead.instagram_url.startsWith('http')
                            ? lead.instagram_url
                            : `https://instagram.com/${lead.instagram_url.replace(/^@/, '')}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sub-detail-info-item__value text-primary hover:underline break-all"
                        dir="ltr"
                      >
                        {lead.instagram_url}
                      </a>
                    </div>
                  )}
                </div>

                <div className="sub-detail-actions">
                  <LeadCodeActionButton
                    lead={lead}
                    activeCode={activeCodeRecord}
                    codes={codes}
                    size="lg"
                    onClick={() => void openCodeDialog(lead)}
                  />
                  {isConvertedLead(lead) && (
                    <Button
                      variant="outline"
                      className="sub-detail-action border-primary/30"
                      onClick={() => setExtendOpen(true)}
                    >
                      <CalendarPlus className="w-4 h-4" />
                      تمديد الاشتراك
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="sub-detail-action bg-[#25D366]/5 text-[#128C7E] border-[#25D366]/30"
                    onClick={() => void handleWhatsApp(whatsAppMessage)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {lead.status === 'new' ? 'تواصل واتساب' : 'متابعة واتساب'}
                  </Button>
                  <Button
                    variant="outline"
                    className="sub-detail-action"
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
                    className="sub-detail-action"
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
              onReissueCode={canReissueCode ? handleReissueCode : undefined}
            />
          </div>

          <div className="sub-detail-grid__side">
            <div className="sub-detail-panel space-y-4">
              <h3 className="sub-detail-panel__title">إدارة الطلب</h3>

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
                  rows={6}
                  className="rounded-xl font-arabic min-h-[140px]"
                  placeholder="السعر المتفق عليه، موعد التفعيل، اعتراضات العميل..."
                />
              </div>

              <Button
                onClick={() => void saveNotes()}
                disabled={saving}
                className="rounded-xl w-full h-11 font-semibold"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GenerateAccessCodeDialog
        lead={lead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        activeCode={activeCodeRecord}
        codes={codes}
        initialDeliver={codeDialogDeliver}
        onReissue={handleReissueCode}
        onReplace={handleReplaceCode}
        replacing={replacingCode}
        onGenerated={({ accessCode, codeId }) => {
          handleGenerated({ accessCode, codeId });
          void refreshAfterCode();
        }}
      />

      {isConvertedLead(lead) && (
        <ExtendSubscriptionDialog
          leadId={lead.id}
          customerName={lead.full_name}
          open={extendOpen}
          onOpenChange={setExtendOpen}
          onExtended={() => {
            void loadCodes(lead.id);
            void refreshAfterCode();
          }}
        />
      )}
    </AdminLayout>
  );
};

export default AdminLeadDetail;
