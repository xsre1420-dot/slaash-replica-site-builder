import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPlanPriceLabel, type PublicSubscriptionPlan } from '@/data/subscriptionPlans';

type SubscriptionRequestSuccessProps = {
  plan: PublicSubscriptionPlan | undefined;
};

const SubscriptionRequestSuccess = ({ plan }: SubscriptionRequestSuccessProps) => (
  <div className="sub-success">
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="sub-success__icon-wrap"
    >
      <CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={1.75} />
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="sub-success__content"
    >
      <h1 className="sub-success__title">تم استلام طلبك بنجاح!</h1>
      <p className="sub-success__desc">
        {plan ? (
          <>
            سنتواصل معك عبر واتساب قريباً لتأكيد{' '}
            <strong>
              {plan.name} ({plan.toggleLabel})
            </strong>{' '}
            — {formatPlanPriceLabel(plan)} — وإكمال تفعيل متجرك.
          </>
        ) : (
          'سيتواصل معك فريقنا عبر واتساب قريباً لإتمام التفعيل.'
        )}
      </p>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="sub-success__steps"
    >
      <div className="sub-success__step">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span>تواصل واتساب من فريق المبيعات</span>
      </div>
      <div className="sub-success__step">
        <Clock className="h-4 w-4 text-primary" />
        <span>خلال ساعات العمل — عادةً خلال 24 ساعة</span>
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35 }}
    >
      <Link to="/">
        <Button variant="outline" className="sub-success__cta">
          العودة للرئيسية
        </Button>
      </Link>
    </motion.div>
  </div>
);

export default SubscriptionRequestSuccess;
