
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-primary py-12 font-arabic border-t border-secondary">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-2xl font-bold mb-4 md:mb-0 text-primary-custom font-english">slaash</div>
          <div className="flex space-x-6">
            <a href="#" className="text-primary-custom hover:text-secondary transition-colors">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="#" className="text-primary-custom hover:text-secondary transition-colors">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-primary-custom hover:text-secondary transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="#" className="text-primary-custom hover:text-secondary transition-colors">
              <Linkedin className="h-5 w-5" />
            </a>
          </div>
        </div>
        <div className="text-center mt-8 text-primary-custom opacity-80">
          © 2024 slaash. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
