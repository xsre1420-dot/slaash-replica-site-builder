import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ExternalLink, CalendarPlus, KeyRound } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ExtendSubscriptionDialog from '@/components/admin/ExtendSubscriptionDialog';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
import SubscriptionOverviewCards from '@/components/admin/subscription/SubscriptionOverviewCards';
import AdminSubscriptionFilters from '@/components/admin/subscription/AdminSubscriptionFilters';
import SubscriptionStatusBadge from '@/components/admin/subscription/SubscriptionStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchLeadById } from '@/services/leadAdminService';
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionRecord } from '@/types/leads';
import { useLeadAccessCodeDialog } from '@/hooks/useLeadAccessCodeDialog';
import { useAdminSubscriptionsPageBundle } from '@/hooks/useAdminSubscriptionsPageBundle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getSubscriptionRemainingDays, planLabelFor } from '@/utils/subscriptionPlanLabels';
import { PUBLIC_SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  ...Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PLAN_OPTIONS = [
  { value: 'all', label: 'كل الباقات' },
  ...PUBLIC_SUBSCRIPTION_PLANS.map((p) => ({
    value: p.id,
    label: `${p.name} — ${p.toggleLabel}`,
  })),
];

const AdminSubscriptions = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [extendLeadId, setExtendLeadId] = useState<string | null>(null);
  const [extendCustomerName, setExtendCustomerName] = useState('');

  const page = useAdminSubscriptionsPageBundle(debouncedSearch, status);

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
  } = useLeadAccessCodeDialog();

  const filteredRows = useMemo(() => {
    if (planFilter === 'all') return page.rows;
    return page.rows.filter((sub) => sub.plan_name === planFilter);
  }, [page.rows, planFilter]);

  const displayTotal = planFilter === 'all' ? page.total : filteredRows.length;

  const openExtend = (sub: SubscriptionRecord) => {
    if (!sub.lead_id) {
      toast.info('لا يوجد طلب مرتبط — افتح من صفحة العملاء');
      return;
    }
    setExtendLeadId(sub.lead_id);
    setExtendCustomerName(sub.store_name || sub.username || '');
  };

  const openCodeForLead = async (sub: SubscriptionRecord) => {
    if (!sub.lead_id) {
      toast.info('لا يوجد طلب مرتبط');
      return;
    }
    try {
      const lead = await fetchLeadById(sub.lead_id);
      if (lead) void openCodeDialog(lead);
    } catch {
      toast.error('تعذر فتح إدارة الرمز');
    }
  };

  const refreshAll = () => {
    void page.refetch();
  };

  const renderSubscriptionRow = (sub: SubscriptionRecord) => {
    const daysLeft = getSubscriptionRemainingDays(sub.end_date);
    const displayName = sub.store_name || sub.username || '—';

    return (
      <article key={sub.id} className="sub-subscription-row">
        <div className="sub-subscription-row__main">
          <div className="sub-subscription-row__avatar">{displayName.charAt(0)}</div>
          <div className="min-w-0">
            <p className="sub-subscription-row__name">{displayName}</p>
            <p className="sub-subscription-row__meta">
              {planLabelFor(sub.plan_name)}
              {sub.lead_id && (
                <>
                  {' · '}
                  <Link
                    to={`/admin/leads/${sub.lead_id}`}
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    تفاصيل الطلب
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="sub-subscription-row__dates">
          <div>
            <span className="text-muted-foreground">البداية: </span>
            <span className="sub-subscription-row__date-value">
              {format(new Date(sub.start_date), 'dd/MM/yyyy', { locale: ar })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">الانتهاء: </span>
            <span className="sub-subscription-row__date-value">
              {sub.end_date
                ? format(new Date(sub.end_date), 'dd/MM/yyyy', { locale: ar })
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">المتبقي: </span>
            {daysLeft === null ? (
              <span>—</span>
            ) : daysLeft <= 0 ? (
              <span className="sub-subscription-row__remaining--expired">منتهٍ</span>
            ) : (
              <span
                className={cn(
                  daysLeft <= 7 && 'sub-subscription-row__remaining--warn'
                )}
              >
                {daysLeft} يوم
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SubscriptionStatusBadge type="subscription" status={sub.status} />
          <div className="sub-subscription-row__actions">
            {sub.lead_id && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-8 text-xs gap-1"
                  onClick={() => void openCodeForLead(sub)}
                >
                  <KeyRound className="w-3 h-3" />
                  رمز
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-8 text-xs gap-1"
                  onClick={() => openExtend(sub)}
                >
                  <CalendarPlus className="w-3 h-3" />
                  تمديد
                </Button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <AdminLayout title="إدارة الاشتراكات">
      <div className="space-y-5">
        <SubscriptionOverviewCards
          stats={page.stats}
          activeStatus={status}
          onStatusFilter={setStatus}
          loading={page.loading}
        />

        <AdminSubscriptionFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالباقة أو اسم المتجر..."
          status={status}
          onStatusChange={setStatus}
          statusOptions={STATUS_OPTIONS}
          plan={planFilter}
          onPlanChange={setPlanFilter}
          planOptions={PLAN_OPTIONS}
          onRefresh={refreshAll}
          loading={page.loading}
          resultCount={displayTotal}
          resultLabel="اشتراك"
        />

        <div className="space-y-3 md:hidden">
          {page.loading ? (
            <div className="sub-admin-table-wrap p-8 text-center text-muted-foreground">
              جاري التحميل...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="sub-admin-table-wrap p-8 text-center text-muted-foreground">
              لا توجد اشتراكات
            </div>
          ) : (
            filteredRows.map(renderSubscriptionRow)
          )}
        </div>

        <div className="sub-admin-table-wrap hidden md:block">
          <div className="sub-admin-table-wrap__header">
            <span>{displayTotal} اشتراك</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الباقة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">البداية</TableHead>
                  <TableHead className="text-right">الانتهاء</TableHead>
                  <TableHead className="text-right">المتبقي</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      لا توجد اشتراكات
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((sub) => {
                    const daysLeft = getSubscriptionRemainingDays(sub.end_date);
                    const displayName = sub.store_name || sub.username || '—';

                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="sub-subscription-row__avatar">{displayName.charAt(0)}</div>
                            <div>
                              <div className="font-medium">{displayName}</div>
                              {sub.lead_id && (
                                <Link
                                  to={`/admin/leads/${sub.lead_id}`}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  تفاصيل الطلب
                                </Link>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{planLabelFor(sub.plan_name)}</TableCell>
                        <TableCell>
                          <SubscriptionStatusBadge type="subscription" status={sub.status} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(sub.start_date), 'dd/MM/yyyy', { locale: ar })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sub.end_date
                            ? format(new Date(sub.end_date), 'dd/MM/yyyy', { locale: ar })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {daysLeft === null ? (
                            '—'
                          ) : daysLeft <= 0 ? (
                            <span className="sub-subscription-row__remaining--expired">منتهٍ</span>
                          ) : (
                            <span
                              className={cn(
                                daysLeft <= 7 && 'sub-subscription-row__remaining--warn'
                              )}
                            >
                              {daysLeft} يوم
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {sub.lead_id && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg h-8 text-xs gap-1"
                                  onClick={() => void openCodeForLead(sub)}
                                >
                                  <KeyRound className="w-3 h-3" />
                                  رمز
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg h-8 text-xs gap-1"
                                  onClick={() => openExtend(sub)}
                                >
                                  <CalendarPlus className="w-3 h-3" />
                                  تمديد
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {extendLeadId && (
        <ExtendSubscriptionDialog
          leadId={extendLeadId}
          customerName={extendCustomerName}
          open={Boolean(extendLeadId)}
          onOpenChange={(open) => {
            if (!open) setExtendLeadId(null);
          }}
          onExtended={() => {
            void page.refetch();
          }}
        />
      )}

      <GenerateAccessCodeDialog
        lead={codeLead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        activeCode={activeCodeRecord}
        codes={codes}
        initialDeliver={codeDialogDeliver}
        onGenerated={handleGenerated}
        onReissue={handleReissueCode}
        onReplace={handleReplaceCode}
        replacing={replacingCode}
      />
    </AdminLayout>
  );
};

export default AdminSubscriptions;
