import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Search,
  MessageCircle,
  Copy,
  Eye,
  KeyRound,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import LeadStatsBar from '@/components/admin/LeadStatsBar';
import LeadWorkflowBadge from '@/components/admin/LeadWorkflowBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchLeads,
  fetchLeadStats,
  markLeadContacted,
  type LeadStatsPayload,
} from '@/services/leadAdminService';
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { canCreateAccessCodeForLead, accessCodeBlockReason } from '@/utils/leadAccessCodeUtils';
import {
  buildInitialWhatsAppMessage,
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [codeLead, setCodeLead] = useState<LeadRecord | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);

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

  const applyQuickFilter = (f: LeadQuickFilter) => {
    setQuickFilter(f);
    if (f !== 'all') setStatus('all');
    const next = new URLSearchParams(searchParams);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    setSearchParams(next, { replace: true });
  };

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

  const openCodeDialog = (lead: LeadRecord) => {
    const block = accessCodeBlockReason(lead);
    if (block === 'converted') {
      toast.info('العميل مُفعّل — راجع تفاصيل الطلب');
      return;
    }
    if (block === 'pending') {
      toast.info('يوجد رمز نشط لهذا العميل — بانتظار التفعيل');
      return;
    }
    if (!canCreateAccessCodeForLead(lead)) {
      toast.info('لا يمكن إنشاء رمز لهذا الطلب');
      return;
    }
    setCodeLead(lead);
    setCodeOpen(true);
  };

  const copyNumber = (phone: string) => {
    void navigator.clipboard.writeText(phone);
    toast.success('تم نسخ الرقم');
  };

  const handleWhatsApp = async (lead: LeadRecord) => {
    try {
      if (lead.status === 'new') {
        await markLeadContacted(lead.id);
        setRows((prev) =>
          prev.map((r) =>
            r.id === lead.id ? { ...r, status: 'contacted', is_unread: false, admin_read_at: new Date().toISOString() } : r
          )
        );
        void loadStats();
      }
    } catch {
      /* still open WhatsApp */
    }
    window.open(buildWhatsAppUrl(lead.whatsapp_number, buildInitialWhatsAppMessage(lead)), '_blank');
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

  const renderWorkflowBadge = (lead: LeadRecord) => <LeadWorkflowBadge lead={lead} />;

  const renderCodeButton = (lead: LeadRecord, fullWidth = false) => {
    if (lead.converted_user_id) {
      return (
        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-500/30">
          مُفعّل
        </Badge>
      );
    }
    if (lead.has_pending_code) {
      return (
        <Badge variant="outline" className="text-xs text-amber-700 border-amber-500/30">
          رمز مُرسَل
        </Badge>
      );
    }
    return (
      <Button
        size={fullWidth ? 'default' : 'sm'}
        className={fullWidth ? 'w-full rounded-xl gap-2' : 'rounded-lg h-9 gap-1.5 text-xs sm:text-sm px-3'}
        onClick={() => openCodeDialog(lead)}
      >
        <KeyRound className="w-4 h-4" />
        إنشاء رمز
      </Button>
    );
  };

  return (
    <AdminLayout title="طلبات الاشتراك">
      <div className="space-y-5">
        <LeadStatsBar
          stats={stats}
          activeFilter={quickFilter}
          onFilter={applyQuickFilter}
          loading={statsLoading}
          resultCount={total}
        />

        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
            onClick={() => setHelpOpen((v) => !v)}
          >
            <span className="font-medium text-muted-foreground">مسار المتابعة: غير مقروء → تواصل → رمز → تفعيل</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', helpOpen && 'rotate-180')} />
          </button>
          {helpOpen && (
            <div className="border-t border-border/50 px-4 py-3 text-sm text-muted-foreground space-y-2">
              <p>1. <strong className="text-foreground font-medium">غير مقروء</strong> — طلب جديد لم يُفتح؛ افتح التفاصيل أو اضغط واتساب.</p>
              <p>2. <strong className="text-foreground font-medium">بانتظار التواصل</strong> — طُلِع عليه؛ راسِل العميل واضغط «تم التواصل».</p>
              <p>3. <strong className="text-foreground font-medium">يحتاج رمز</strong> — بعد الاتفاق أنشئ رمز التفعيل وأرسله.</p>
              <p>4. <strong className="text-foreground font-medium">بانتظار التفعيل</strong> — العميل يدخل من /login بالرمز.</p>
              <p>5. <strong className="text-foreground font-medium">مُفعّل</strong> — يظهر ضمن «عملاء مُفعّلون» ويخرج من مسار المتابعة.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-border/50 bg-card p-3 sm:p-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث: اسم، واتساب، باقة، محافظة..."
              className="pr-10 rounded-xl font-arabic bg-background"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange} disabled={quickFilter !== 'all'}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl bg-background">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {LEAD_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-xl gap-2 shrink-0" onClick={refreshAll}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            تحديث
          </Button>
        </div>

        {/* Mobile */}
        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
              {getLeadFilterEmptyMessage(quickFilter)}
            </div>
          ) : (
            rows.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{lead.full_name}</p>
                      {renderWorkflowBadge(lead)}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                      {lead.whatsapp_number}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatLeadRelativeTime(lead.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lead.selected_plan_name && <Badge variant="outline">{lead.selected_plan_name}</Badge>}
                  {lead.governorate && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {lead.governorate}
                    </Badge>
                  )}
                </div>
                {renderCodeButton(lead, true)}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2 text-[#25D366] border-[#25D366]/30"
                    onClick={() => void handleWhatsApp(lead)}
                  >
                    <MessageCircle className="w-4 h-4" />
                    واتساب
                  </Button>
                  {lead.status === 'new' && (
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2"
                      onClick={() => void handleMarkContacted(lead)}
                    >
                      <PhoneCall className="w-4 h-4" />
                      تم التواصل
                    </Button>
                  )}
                  <Link to={`/admin/leads/${lead.id}`} className={lead.status === 'new' ? '' : 'col-span-2'}>
                    <Button variant="outline" className="w-full rounded-xl gap-2">
                      <Eye className="w-4 h-4" />
                      التفاصيل
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="hidden md:block rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} طلب</span>
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
                  <TableHead className="text-right">مرحلة المتابعة</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">الوقت</TableHead>
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
                    <TableRow key={lead.id} className={lead.is_unread ? 'bg-primary/[0.02]' : undefined}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-medium">{lead.full_name}</div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
                            {lead.whatsapp_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.selected_plan_name ? (
                            <Badge variant="outline">{lead.selected_plan_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                          {lead.governorate && (
                            <p className="text-xs text-muted-foreground">{lead.governorate}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[140px]">
                        {getMonthlyOrderLabel(lead.expected_monthly_orders)}
                      </TableCell>
                      <TableCell>{renderWorkflowBadge(lead)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        <div>{formatLeadRelativeTime(lead.created_at)}</div>
                        <div className="text-[11px]">
                          {format(new Date(lead.created_at), 'dd MMM', { locale: ar })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {renderCodeButton(lead)}
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
                              className="rounded-lg h-9 px-2 text-xs"
                              onClick={() => void handleMarkContacted(lead)}
                            >
                              تم التواصل
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg h-9 px-2.5"
                            onClick={() => copyNumber(lead.whatsapp_number)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
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
        onGenerated={() => {
          if (codeLead) {
            setRows((prev) =>
              prev.map((row) =>
                row.id === codeLead.id
                  ? { ...row, has_pending_code: true, status: row.status === 'new' || row.status === 'contacted' ? 'interested' : row.status }
                  : row
              )
            );
          }
          void load();
          void loadStats();
        }}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
