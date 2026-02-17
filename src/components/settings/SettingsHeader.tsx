import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";

const SettingsHeader = () => {
  return (
    <div className="bg-card border-b border-border sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <Link to="/builder">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">الإعدادات</h1>
            <Settings className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="w-10" />
        </div>
      </div>
    </div>
  );
};

export default SettingsHeader;
