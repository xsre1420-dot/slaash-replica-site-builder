import { Link, useLocation } from "react-router-dom";
import { Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background font-arabic p-6" dir="rtl">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-primary mb-2">404</p>
        <h1 className="text-xl font-bold text-foreground mb-2">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          الرابط <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> غير صالح أو تم نقله.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/builder">
            <Button className="rounded-xl min-h-[44px] gap-2 w-full sm:w-auto">
              <Home className="w-4 h-4" />
              لوحة التحكم
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="rounded-xl min-h-[44px] gap-2 w-full sm:w-auto">
              <ArrowRight className="w-4 h-4" />
              الصفحة الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
