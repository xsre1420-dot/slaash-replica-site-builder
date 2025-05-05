
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";

const Index = () => {
  const { storeName } = useStore();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900 to-red-800 flex flex-col items-center justify-between p-8 text-white">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="w-32 h-32 relative mb-4">
            <div className="absolute transform rotate-12 bg-white w-24 h-12"></div>
            <div className="absolute transform -rotate-12 -translate-y-2 bg-white w-24 h-12"></div>
          </div>
          <div className="text-center">
            <h1 className="text-6xl font-bold mb-1">{storeName}</h1>
            <h2 className="text-2xl uppercase tracking-wider">NUMO</h2>
          </div>
        </div>
        
        {/* Login Button */}
        <Link to="/login" className="w-full max-w-md">
          <button className="w-full bg-white text-black rounded-full py-5 px-8 flex items-center justify-center text-xl font-bold">
            <span className="ml-2">سجل الدخول</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </Link>
      </div>
      
      {/* Footer */}
      <div className="mt-10 text-center text-sm opacity-80">
        <p>نظام إدارة المطاعم والمقاهي © 2025</p>
      </div>
    </div>
  );
};

export default Index;
