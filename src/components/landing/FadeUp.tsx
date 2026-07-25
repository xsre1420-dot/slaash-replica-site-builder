import { useRef, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';

export const FadeUp = ({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const SectionBadge = ({ children }: { children: ReactNode }) => (
  <span className="lp-badge">{children}</span>
);

export const SectionTitle = ({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: 'center' | 'right';
}) => (
  <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-right'}>
    {eyebrow && <SectionBadge>{eyebrow}</SectionBadge>}
    <h2 className="lp-section-title">{title}</h2>
    {subtitle && <p className="lp-section-subtitle">{subtitle}</p>}
  </div>
);
