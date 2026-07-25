import { Shield, Headphones, Zap } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Shield, label: 'تفعيل آمن ومحمي' },
  { icon: Headphones, label: 'دعم فني مخصص' },
  { icon: Zap, label: 'متجرك جاهز خلال أيام' },
] as const;

const SubscriptionTrustStrip = () => (
  <div className="sub-trust-strip">
    {TRUST_ITEMS.map(({ icon: Icon, label }) => (
      <div key={label} className="sub-trust-strip__item">
        <span className="sub-trust-strip__icon">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span>{label}</span>
      </div>
    ))}
  </div>
);

export default SubscriptionTrustStrip;
