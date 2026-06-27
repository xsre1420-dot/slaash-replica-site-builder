import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OrdersPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

const OrdersPagination = ({
  page,
  totalPages,
  total,
  pageSize,
  loading = false,
  onPageChange,
  className,
}: OrdersPaginationProps) => {
  if (total <= 0) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  const pages: (number | 'ellipsis')[] = [];
  const maxButtons = 5;
  let start = Math.max(0, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages - 1, start + maxButtons - 1);
  start = Math.max(0, end - maxButtons + 1);

  for (let i = start; i <= end; i++) pages.push(i);
  if (start > 0) pages.unshift('ellipsis', 0);
  if (end < totalPages - 1) pages.push('ellipsis', totalPages - 1);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 pt-2',
        className
      )}
      dir="rtl"
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} من {total} طلب
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg"
          disabled={page <= 0 || loading}
          onClick={() => onPageChange(page - 1)}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-muted-foreground text-xs">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-9 min-w-[36px] rounded-lg px-2 text-xs tabular-nums"
              disabled={loading}
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg"
          disabled={page >= totalPages - 1 || loading}
          onClick={() => onPageChange(page + 1)}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default OrdersPagination;
