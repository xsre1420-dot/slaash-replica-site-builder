
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";

const Index = () => {
  const { storeName } = useStore();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-secondary flex flex-col items-center justify-between p-8 text-primary-custom">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="w-32 h-32 relative mb-4">
            <div className="absolute transform rotate-12 bg-primary-custom w-24 h-12"></div>
            <div className="absolute transform -rotate-12 -translate-y-2 bg-primary-custom w-24 h-12"></div>
          </div>
          <div className="text-center font-arabic">
            <h1 className="text-6xl font-bold mb-1 text-primary-custom">{storeName}</h1>
            <h2 className="text-2xl uppercase tracking-wider font-english text-primary-custom">NUMO</h2>
          </div>
        </div>
        
        {/* Login Button */}
        <Link to="/login" className="w-full max-w-md">
          <button className="w-full bg-primary-custom text-primary rounded-full py-5 px-8 flex items-center justify-center text-xl font-bold font-arabic hover:bg-accent transition-colors">
            <span className="ml-2">سجل الدخول</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </Link>
      </div>
      
      {/* Footer */}
      <div className="mt-10 text-center text-sm opacity-80 font-arabic text-primary-custom">
        <p>نظام إدارة المطاعم والمقاهي © 2025</p>
      </div>
    </div>
  );
};

export default Index;
