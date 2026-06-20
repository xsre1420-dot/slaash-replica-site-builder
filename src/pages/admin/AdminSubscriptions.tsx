import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
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
import { fetchSubscriptions } from '@/services/leadAdminService';
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionRecord } from '@/types/leads';
import { toast } from 'sonner';

const AdminSubscriptions = () => {
  const [rows, setRows] = useState<SubscriptionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    لا توجد اشتراكات
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="font-medium">{sub.store_name || sub.username || '—'}</div>
                      <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                        {sub.user_id.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>{sub.plan_name}</TableCell>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
