
import { Dispatch, SetStateAction } from "react";
import { Search, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface OrdersFiltersProps {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  dateFilter: Date | undefined;
  setDateFilter: Dispatch<SetStateAction<Date | undefined>>;
  clearDateFilter: () => void;
}

const OrdersFilters = ({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  clearDateFilter,
}: OrdersFiltersProps) => {
  return (
    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
      <div className="flex items-center gap-2 w-full md:w-auto">
        <Input
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-right"
        />
        <Button variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-right font-normal",
                !dateFilter && "text-muted-foreground"
              )}
            >
              {dateFilter ? format(dateFilter, "yyyy-MM-dd") : "تصفية حسب التاريخ"}
              <CalendarRange className="mr-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={dateFilter}
              onSelect={setDateFilter}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="p-3 border-t border-border">
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={clearDateFilter}
              >
                مسح التصفية
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default OrdersFilters;
