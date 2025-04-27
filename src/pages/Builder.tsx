import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Plus, QrCode, Tags, Copy, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductsList } from "@/components/ProductsList";

const Builder = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 flex justify-between items-center">
        <X className="w-6 h-6" />
        <h1 className="text-xl font-bold">يوسف</h1>
        <div className="flex gap-4">
          <Link className="p-2 rounded-full bg-red-500" to="#">
            <Copy className="w-5 h-5" />
          </Link>
          <button className="p-2 rounded-full bg-red-500">
            <img src="/lovable-uploads/6fd4999f-4557-46fe-922a-3af4fd437caf.png" alt="Profile" className="w-5 h-5 rounded-full" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* Restaurant Link Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="text-gray-600 text-right">
              <h2 className="text-xl font-bold text-red-600">رابط المطعم</h2>
              <p className="text-sm">مشاركة الرابط مع الزبائن</p>
            </div>
            <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
              نسخ
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div className="relative">
            <Input 
              placeholder="ابحث عن وجبة..."
              className="w-full pl-10 text-right"
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/preview" className="w-full">
              <Button variant="outline" className="w-full border-gray-200 hover:bg-gray-50 space-x-2">
                <Eye className="w-4 h-4" />
                <span>معاينة</span>
              </Button>
            </Link>
            <Link to="/add-product" className="w-full">
              <Button className="w-full bg-red-600 hover:bg-red-700 space-x-2">
                <Plus className="w-4 h-4" />
                <span>إضافة وجبة</span>
              </Button>
            </Link>
            <Button variant="outline" className="border-gray-200 hover:bg-gray-50 space-x-2">
              <QrCode className="w-4 h-4" />
              <span>منيو QR</span>
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 space-x-2">
              <Tags className="w-4 h-4" />
              <span>الأصناف</span>
            </Button>
          </div>
        </div>

        {/* Products List */}
        <ProductsList />
      </div>
    </div>
  );
};

export default Builder;
