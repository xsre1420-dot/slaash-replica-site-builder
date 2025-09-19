import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const ModernHero = () => {
  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-12">
        <div className="flex items-center gap-3 font-english">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-lg"></div>
          <span className="text-2xl font-bold text-gray-900">slaash</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-gray-700 font-medium">
          <a href="#features" className="hover:text-gray-900 transition-colors">المنتج</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">الحلول</a>
          <a href="#" className="hover:text-gray-900 transition-colors">من نحن</a>
        </div>
        
        <Link to="/login">
          <Button className="btn-dark">
            تواصل معنا
          </Button>
        </Link>
      </nav>

      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 lg:px-12 pb-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-lg md:text-xl text-gray-600 mb-4 font-arabic">
            حسّن من
          </p>
          
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-gray-900 mb-8 leading-tight font-english">
            Productivity
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 mb-12 font-english">
            with AI
          </p>
          
          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto font-arabic">
            حلول رقمية مخصصة للصناعات عالية التخصص
            التي تساعد في تعزيز عملياتك
          </p>
          
          <Link to="/signup">
            <Button className="btn-dark">
              تواصل معنا
            </Button>
          </Link>
        </div>
      </div>

      {/* Company Logos */}
      <div className="pb-12">
        <div className="flex items-center justify-center gap-8 md:gap-16 opacity-60">
          <div className="text-2xl font-bold text-gray-700">EBK</div>
          <div className="text-2xl font-bold text-gray-700">ERHARD</div>
          <div className="text-2xl font-bold text-gray-700">PRINTEKK</div>
          <div className="text-2xl font-bold text-gray-700">hkr</div>
          <div className="text-2xl font-bold text-gray-700">siteco</div>
        </div>
      </div>
    </div>
  );
};