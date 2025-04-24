
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative">
      <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-4xl leading-tight animate-fade-in">
        Create Beautiful Websites
        <span className="text-gradient"> Without Code</span>
      </h1>
      <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl animate-fade-in">
        Build and launch professional websites in minutes with our AI-powered platform.
        No coding required.
      </p>
      <Button size="lg" className="animate-fade-in" asChild>
        <Link to="/builder">
          Get Started <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
};
