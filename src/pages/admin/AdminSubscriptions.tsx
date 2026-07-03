import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, ExternalLink, CalendarPlus, KeyRound } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import ExtendSubscriptionDialog from '@/components/admin/ExtendSubscriptionDialog';
import GenerateAccessCodeDialog from '@/components/admin/GenerateAccessCodeDialog';
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
import { fetchLeadById, fetchSubscriptions } from '@/services/leadAdminService';
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionRecord } from '@/types/leads';
import { useLeadAccessCodeDialog } from '@/hooks/useLeadAccessCodeDialog';
import { getSubscriptionRemainingDays, planLabelFor } from '@/utils/subscriptionPlanLabels';
import { toast } from 'sonner';

const AdminSubscriptions = () => {
  const [rows, setRows] = useState<SubscriptionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [extendLeadId, setExtendLeadId] = useState<string | null>(null);
  const [extendCustomerName, setExtendCustomerName] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSubscriptions({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
      });
      setRows(result.rows as SubscriptionRecord[]);
      setTotal(result.total);
    } catch {
      toast.error('تعذر تحميل الاشتراكات');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

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

  return (
    <AdminLayout title="إدارة الاشتراكات">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالباقة أو اسم المستخدم..."
              className="pr-10 rounded-xl"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[160px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="expired">منتهي</SelectItem>
              <SelectItem value="suspended">موقوف</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b text-sm text-muted-foreground">{total} اشتراك</div>
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    لا توجد اشتراكات
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((sub) => {
                  const daysLeft = getSubscriptionRemainingDays(sub.end_date);
                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.store_name || sub.username || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {sub.user_id.slice(0, 8)}...
                        </div>
                        {sub.lead_id && (
                          <Link
                            to={`/admin/leads/${sub.lead_id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            تفاصيل الطلب
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>{planLabelFor(sub.plan_name)}</TableCell>
                      <TableCell>
                        <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                          {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                        </Badge>
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
                          <span className="text-destructive">منتهٍ</span>
                        ) : (
                          <span className={daysLeft <= 7 ? 'text-amber-700 font-medium' : ''}>
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

      {extendLeadId && (
        <ExtendSubscriptionDialog
          leadId={extendLeadId}
          customerName={extendCustomerName}
          open={Boolean(extendLeadId)}
          onOpenChange={(open) => {
            if (!open) setExtendLeadId(null);
          }}
          onExtended={() => void load()}
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
