
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const SettingsHeader = () => {
  return (
    <div className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/builder">
            <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
              <ArrowRight className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-black">إعدادات المتجر</h1>
          <div className="w-10"></div>
        </div>
      </div>
    </div>
  );
};

export default SettingsHeader;
