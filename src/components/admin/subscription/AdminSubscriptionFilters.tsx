import { Search, RefreshCw, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type FilterOption = { value: string; label: string };

type AdminSubscriptionFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: FilterOption[];
  statusDisabled?: boolean;
  plan?: string;
  onPlanChange?: (value: string) => void;
  planOptions?: FilterOption[];
  onRefresh?: () => void;
  loading?: boolean;
  resultCount?: number;
  resultLabel?: string;
};

const AdminSubscriptionFilters = ({
  search,
  onSearchChange,
  searchPlaceholder = 'بحث...',
  status,
  onStatusChange,
  statusOptions,
  statusDisabled,
  plan,
  onPlanChange,
  planOptions,
  onRefresh,
  loading,
  resultCount,
  resultLabel = 'نتيجة',
}: AdminSubscriptionFiltersProps) => (
  <div className="sub-admin-filters">
    <div className="sub-admin-filters__row">
      <div className="sub-admin-filters__search">
        <Search className="sub-admin-filters__search-icon" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="sub-admin-filters__input"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange} disabled={statusDisabled}>
        <SelectTrigger className="sub-admin-filters__select">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
          <SelectValue placeholder="الحالة" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {planOptions && onPlanChange && (
        <Select value={plan ?? 'all'} onValueChange={onPlanChange}>
          <SelectTrigger className="sub-admin-filters__select">
            <SelectValue placeholder="الباقة" />
          </SelectTrigger>
          <SelectContent>
            {planOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {onRefresh && (
        <Button
          variant="outline"
          className="sub-admin-filters__refresh"
          onClick={onRefresh}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">تحديث</span>
        </Button>
      )}
    </div>

    {resultCount !== undefined && (
      <p className="sub-admin-filters__count">
        {resultCount} {resultLabel}
      </p>
    )}
  </div>
);

export default AdminSubscriptionFilters;
