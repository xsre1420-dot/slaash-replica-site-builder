import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, MessageCircle, Copy, Eye, KeyRound } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
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
import { fetchLeads } from '@/services/leadAdminService';
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  buildWhatsAppUrl,
  type LeadRecord,
  type LeadStatus,
} from '@/types/leads';
import { toast } from 'sonner';

const STEPS = [
  { n: '1', title: 'تواصل', desc: 'واتساب العميل' },
  { n: '2', title: 'أنشئ رمز', desc: 'زر واحد' },
  { n: '3', title: 'أرسل', desc: 'نسخ أو واتساب' },
];

const AdminLeads = () => {
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [codeLead, setCodeLead] = useState<LeadRecord | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLeads({
        search: search.trim() || undefined,
        status: status === 'all' ? '' : (status as LeadStatus),
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch {
      toast.error('تعذر تحميل العملاء المحتملين');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const openCodeDialog = (lead: LeadRecord) => {
    setCodeLead(lead);
    setCodeOpen(true);
  };

  const copyNumber = (phone: string) => {
    void navigator.clipboard.writeText(phone);
    toast.success('تم نسخ الرقم');
  };

  return (
    <AdminLayout title="طلبات الاشتراك">
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold mb-3">خطوات بسيطة</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-xl bg-muted/40 px-3 py-3 text-center sm:text-right sm:flex sm:items-center sm:gap-3"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold sm:shrink-0">
                  {step.n}
                </span>
                <div className="mt-2 sm:mt-0">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو رقم واتساب..."
              className="pr-10 rounded-xl font-arabic"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
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
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            تحديث
          </Button>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 text-sm text-muted-foreground">
            {total} طلب
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right hidden md:table-cell">الباقة</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">المحافظة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">التاريخ</TableHead>
                  <TableHead className="text-right min-w-[200px]">إجراء</TableHead>
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
                      لا توجد طلبات بعد
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="flex items-center gap-2">
                            {lead.full_name}
                            {lead.is_unread && <Badge className="h-5 text-[10px]">جديد</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
                            {lead.whatsapp_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {lead.selected_plan_name ? (
                          <Badge variant="outline">{lead.selected_plan_name}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.governorate || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lead.status !== 'customer' && (
                            <Button
                              size="sm"
                              className="rounded-lg h-8 gap-1.5 text-xs"
                              onClick={() => openCodeDialog(lead)}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              إنشاء رمز
                            </Button>
                          )}
                          <a
                            href={buildWhatsAppUrl(lead.whatsapp_number, `مرحباً ${lead.full_name}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline" className="rounded-lg h-8 px-2 text-[#25D366] border-[#25D366]/30">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg h-8 px-2"
                            onClick={() => copyNumber(lead.whatsapp_number)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Link to={`/admin/leads/${lead.id}`}>
                            <Button size="sm" variant="ghost" className="rounded-lg h-8 px-2">
                              <Eye className="w-3.5 h-3.5" />
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
      </div>

      <GenerateAccessCodeDialog
        lead={codeLead}
        open={codeOpen}
        onOpenChange={setCodeOpen}
        onGenerated={() => void load()}
      />
    </AdminLayout>
  );
};

export default AdminLeads;
