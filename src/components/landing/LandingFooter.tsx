import { landingFooter } from '@/content/landingCopy';

const LandingFooter = () => (
  <footer className="border-t border-[#e2e8f0] bg-white py-10">
    <div className="container mx-auto px-4 text-center">
      <img
        src="/lovable-uploads/f51ae0c5-1208-4965-a0c7-85a6d908ceb1.png"
        alt="بداية"
        className="mx-auto mb-3 h-9 w-auto"
      />
      <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-[#64748b]">{landingFooter.tagline}</p>
      <p className="text-xs text-[#94a3b8]">{landingFooter.copyright}</p>
    </div>
  </footer>
);

export default LandingFooter;
