
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";

const Index = () => {
  const { storeName } = useStore();
  
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between p-8 text-gray-800 font-arabic">
      {/* Header */}
      <div className="w-full bg-primary text-white py-4 px-6 text-center fixed top-0 left-0 z-10">
        <h1 className="text-xl font-bold flex items-center justify-center">
          نظام إدارة المتاجر <span className="mx-2">🍽️</span>
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full mt-20">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="w-32 h-32 relative mb-4">
            <div className="absolute transform rotate-12 bg-white w-24 h-12 shadow-lg rounded-lg"></div>
            <div className="absolute transform -rotate-12 -translate-y-2 bg-primary/10 w-24 h-12 rounded-lg"></div>
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-2 text-gray-800">{storeName}</h1>
            <h2 className="text-xl uppercase tracking-wider font-english text-primary">NUMO</h2>
          </div>
        </div>
        
        {/* Login Button */}
        <Link to="/login" className="w-full max-w-md">
          <button className="w-full bg-primary text-white rounded-full py-5 px-8 flex items-center justify-center text-lg font-bold hover:bg-primary/90 transition-colors shadow-lg">
            <span className="ml-2">سجل الدخول</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
      </div>
      
      {/* Footer */}
      <div className="mt-10 text-center text-sm text-gray-600">
        <p>جميع الحقوق محفوظة © 2025 نظام إدارة المتاجر والمقاهي</p>
      </div>
    </div>
  );
};

export default Index;
