import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  MessageCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import LeadCodeActionButton from '@/components/admin/LeadCodeActionButton';
import LeadStatsBar from '@/components/admin/LeadStatsBar';
import { LeadOverviewCards } from '@/components/admin/subscription/SubscriptionOverviewCards';
import AdminSubscriptionFilters from '@/components/admin/subscription/AdminSubscriptionFilters';
import LeadRequestMobileCard, {
  LeadRequestCopyButton,
  LeadRequestDesktopMeta,
} from '@/components/admin/subscription/LeadRequestMobileCard';
import SubscriptionStatusBadge from '@/components/admin/subscription/SubscriptionStatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  fetchLeads,
  fetchLeadStats,
  markLeadContacted,
  type LeadStatsPayload,
} from '@/services/leadAdminService';
import {
  LEAD_STATUS_OPTIONS,
  LEAD_STATUS_LABELS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { useLeadAccessCodeDialog } from '@/hooks/useLeadAccessCodeDialog';
import {
  buildInitialWhatsAppMessage,
  buildFollowUpWhatsAppMessage,
  formatLeadRelativeTime,
  getLeadFilterEmptyMessage,
  LEAD_FILTER_DEFINITIONS,
  type LeadQuickFilter,
} from '@/utils/leadWorkflowUtils';
import { getMonthlyOrderLabel } from '@/data/leadFormOptions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useVisibilityAwareInterval } from '@/hooks/useVisibilityAwareInterval';

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  ...LEAD_STATUS_OPTIONS.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
];

const AdminLeads = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LeadStatsPayload | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<LeadQuickFilter>('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const patchLeadRow = useCallback((leadId: string, patch: Partial<LeadRecord>) => {
    setRows((prev) => prev.map((row) => (row.id === leadId ? { ...row, ...patch } : row)));
  }, []);

  const applyQuickFilter = useCallback(
    (f: LeadQuickFilter) => {
      setQuickFilter(f);
      if (f !== 'all') setStatus('all');
      const next = new URLSearchParams(searchParams);
      if (f === 'all') next.delete('filter');
      else next.set('filter', f);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const {
    codeOpen,
    setCodeOpen,
    codeLead,
    codes,
    activeCodeRecord,
    codeDialogDeliver,
    openCodeDialog,
    handleGenerated,
    handleReissueCode,
    handleReplaceCode,
    replacingCode,
  } = useLeadAccessCodeDialog({
    onLeadPatch: patchLeadRow,
    onAfterCodeGenerated: () => {
      applyQuickFilter('pending_activation');
      toast.success('تم إنشاء الرمز — نُقل الطلب إلى «مكتمل»');
    },
  });

  const activeCodesByLead = useMemo(() => {
    const map = new Map<string, typeof activeCodeRecord>();
    if (codeLead && activeCodeRecord) {
      map.set(codeLead.id, activeCodeRecord);
    }
    return map;
  }, [codeLead, activeCodeRecord]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await fetchLeadStats());
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLeads({
        search: search.trim() || undefined,
        status: status === 'all' ? '' : (status as LeadStatus),
        filter: quickFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch {
      toast.error('تعذر تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [search, status, quickFilter, page]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    const validIds = LEAD_FILTER_DEFINITIONS.map((d) => d.id);
    if (urlFilter && validIds.includes(urlFilter as LeadQuickFilter)) {
      setQuickFilter(urlFilter as LeadQuickFilter);
    } else if (!urlFilter) {
      setQuickFilter('all');
    }
  }, [searchParams]);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    if (value !== 'all') {
      setQuickFilter('all');
      const next = new URLSearchParams(searchParams);
      next.delete('filter');
      setSearchParams(next, { replace: true });
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [search, status, quickFilter]);

  useVisibilityAwareInterval(() => {
    void loadStats();
    void load();
  }, 60_000);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const copyNumber = (phone: string) => {
    void navigator.clipboard.writeText(phone);
    toast.success('تم نسخ الرقم');
  };

  const handleWhatsApp = async (lead: LeadRecord) => {
    try {
      if (lead.status === 'new') {
        await markLeadContacted(lead.id);
        patchLeadRow(lead.id, {
          status: 'contacted',
          is_unread: false,
          admin_read_at: new Date().toISOString(),
        });
        void loadStats();
      }
    } catch {
      /* still open WhatsApp */
    }
    const message =
      lead.status === 'contacted' || lead.status === 'interested'
        ? buildFollowUpWhatsAppMessage(lead)
        : buildInitialWhatsAppMessage(lead);
    window.open(buildWhatsAppUrl(lead.whatsapp_number, message), '_blank');
  };

  const handleMarkContacted = async (lead: LeadRecord) => {
    try {
      await markLeadContacted(lead.id);
      toast.success('تم تسجيل التواصل');
      void load();
      void loadStats();
    } catch {
      toast.error('تعذر التحديث');
    }
  };

  const refreshAll = () => {
    void loadStats();
    void load();
  };

  return (
    <AdminLayout title="طلبات الاشتراك">
      <div className="space-y-5">
        <LeadOverviewCards stats={stats} loading={statsLoading} />

        <LeadStatsBar
          stats={stats}
          activeFilter={quickFilter}
          onFilter={applyQuickFilter}
          loading={statsLoading}
          resultCount={total}
        />

        <AdminSubscriptionFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث: اسم، واتساب، باقة، محافظة..."
          status={status}
          onStatusChange={handleStatusChange}
          statusOptions={STATUS_FILTER_OPTIONS}
          statusDisabled={quickFilter !== 'all'}
          onRefresh={refreshAll}
          loading={loading}
          resultCount={total}
          resultLabel="طلب"
        />

        {/* Mobile */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="sub-admin-table-wrap p-8 text-center text-muted-foreground">
              جاري التحميل...
            </div>
          ) : rows.length === 0 ? (
            <div className="sub-admin-table-wrap p-8 text-center text-muted-foreground">
              {getLeadFilterEmptyMessage(quickFilter)}
            </div>
          ) : (
            rows.map((lead) => (
              <LeadRequestMobileCard
                key={lead.id}
                lead={lead}
                activeCode={activeCodesByLead.get(lead.id) ?? null}
                codes={codeLead?.id === lead.id ? codes : []}
                onWhatsApp={() => void handleWhatsApp(lead)}
                onMarkContacted={
                  lead.status === 'new' ? () => void handleMarkContacted(lead) : undefined
                }
                onCopyPhone={() => copyNumber(lead.whatsapp_number)}
                onOpenCode={() => void openCodeDialog(lead)}
              />
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="sub-admin-table-wrap hidden md:block">
          <div className="sub-admin-table-wrap__header">
            <span>{total} طلب اشتراك</span>
            {totalPages > 1 && (
              <span>
                صفحة {page + 1} من {totalPages}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الباقة / المحافظة</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">الحجم</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">التاريخ</TableHead>
                  <TableHead className="text-right min-w-[260px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {getLeadFilterEmptyMessage(quickFilter)}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={cn(lead.is_unread && 'sub-row--unread')}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="sub-request-card__avatar hidden sm:flex">
                            {lead.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{lead.full_name}</div>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
                              {lead.whatsapp_number}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <LeadRequestDesktopMeta lead={lead} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[140px]">
                        {getMonthlyOrderLabel(lead.expected_monthly_orders)}
                      </TableCell>
                      <TableCell>
                        <SubscriptionStatusBadge type="workflow" lead={lead} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        <div>{formatLeadRelativeTime(lead.created_at)}</div>
                        <div className="text-[11px]">
                          {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: ar })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <LeadCodeActionButton
                            lead={lead}
                            activeCode={activeCodesByLead.get(lead.id) ?? null}
                            codes={codeLead?.id === lead.id ? codes : []}
                            onClick={() => void openCodeDialog(lead)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-9 px-2.5 text-[#25D366] border-[#25D366]/30"
                            onClick={() => void handleWhatsApp(lead)}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          {lead.status === 'new' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg h-9 px-2 text-xs gap-1"
                              onClick={() => void handleMarkContacted(lead)}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              تم التواصل
                            </Button>
                          )}
                          <LeadRequestCopyButton onCopy={() => copyNumber(lead.whatsapp_number)} />
                          <Link to={`/admin/leads/${lead.id}`}>
                            <Button size="sm" variant="ghost" className="rounded-lg h-9 px-2.5">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <GenerateAccessCodeDialog
        lead={codeLead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        activeCode={activeCodeRecord}
        codes={codes}
        initialDeliver={codeDialogDeliver}
        onReissue={handleReissueCode}
        onReplace={handleReplaceCode}
        replacing={replacingCode}
        onGenerated={({ accessCode, codeId, meta }) => {
          handleGenerated({ accessCode, codeId, meta });
          void loadStats();
        }}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
