import { ArrowLeft, Mail } from 'lucide-react';
import { useState } from 'react';

interface StorefrontNewsletterProps {
  storeName: string;
}

const StorefrontNewsletter = ({ storeName }: StorefrontNewsletterProps) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail('');
  };

  return (
    <section className="sf-container py-12">
      <div className="sf-newsletter text-right">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              اشترك في نشرة {storeName}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              احصل على أحدث العروض والمنتجات الجديدة مباشرة في بريدك
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="بريدك الإلكتروني"
            className="sf-input flex-1"
            dir="ltr"
          />
          <button type="submit" className="sf-btn-primary shrink-0">
            اشتراك
            <ArrowLeft className="w-4 h-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </section>
  );
};

export default StorefrontNewsletter;
