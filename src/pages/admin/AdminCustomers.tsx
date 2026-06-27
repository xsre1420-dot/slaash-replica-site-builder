import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Search, MessageCircle } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchLeads } from '@/services/leadAdminService';
import { buildWhatsAppUrl, type LeadRecord } from '@/types/leads';
import { toast } from 'sonner';

const AdminCustomers = () => {
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLeads({ search: search.trim() || undefined, status: 'customer' });
      setRows(result.rows);
    } catch {
      toast.error('تعذر تحميل العملاء');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AdminLayout title="إدارة العملاء">
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث..."
            className="pr-10 rounded-xl"
          />
        </div>

        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">واتساب</TableHead>
                <TableHead className="text-right">تاريخ التحويل</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    لا يوجد عملاء بعد
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name}</TableCell>
                    <TableCell dir="ltr">{lead.whatsapp_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.converted_at
                        ? format(new Date(lead.converted_at), 'dd MMM yyyy', { locale: ar })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <a href={buildWhatsAppUrl(lead.whatsapp_number)} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="text-[#25D366]">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </a>
                        <Link to={`/admin/leads/${lead.id}`}>
                          <Button size="icon" variant="ghost">
                            <Badge variant="outline">تفاصيل</Badge>
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
    </AdminLayout>
  );
};

export default AdminCustomers;
