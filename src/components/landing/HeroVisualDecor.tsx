import { motion, useReducedMotion } from 'framer-motion';

type HeroVisualDecorProps = {
  animate?: boolean;
};

const stars = [
  { top: '8%', left: '18%', size: 10, opacity: 0.9, delay: 0 },
  { top: '14%', right: '22%', size: 8, opacity: 0.75, delay: 0.4 },
  { top: '28%', left: '8%', size: 7, opacity: 0.55, delay: 0.8 },
  { top: '22%', right: '10%', size: 12, opacity: 0.85, delay: 0.2 },
  { top: '42%', left: '14%', size: 6, opacity: 0.5, delay: 1.1 },
  { top: '38%', right: '16%', size: 9, opacity: 0.7, delay: 0.6 },
  { top: '56%', left: '22%', size: 8, opacity: 0.65, delay: 0.3 },
  { top: '52%', right: '24%', size: 7, opacity: 0.45, delay: 1.4 },
  { top: '68%', left: '12%', size: 9, opacity: 0.6, delay: 0.9 },
  { top: '62%', right: '8%', size: 11, opacity: 0.8, delay: 0.5 },
];

const FourPointStar = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2L12 2Z"
      fill="currentColor"
    />
  </svg>
);

const HeroVisualDecor = ({ animate = true }: HeroVisualDecorProps) => (
  <div className="lp-hero-visual-decor pointer-events-none absolute inset-0" aria-hidden>
    <div className="lp-hero-glow-center" />
    <svg className="lp-hero-orbit lp-hero-orbit--outer" viewBox="0 0 900 520" fill="none" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="450" cy="300" rx="390" ry="210" stroke="currentColor" strokeWidth="1.25" />
    </svg>
    <svg className="lp-hero-orbit lp-hero-orbit--inner" viewBox="0 0 720 420" fill="none" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="360" cy="250" rx="300" ry="165" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" />
    </svg>

    {stars.map((star, index) => {
      const style = {
        top: star.top,
        left: star.left,
        right: star.right,
        width: star.size,
        height: star.size,
        opacity: star.opacity,
      };

      if (!animate) {
        return (
          <span key={index} className="lp-hero-star" style={style}>
            <FourPointStar size={star.size} />
          </span>
        );
      }

      return (
        <motion.span
          key={index}
          className="lp-hero-star"
          style={style}
          animate={{ opacity: [star.opacity * 0.55, star.opacity, star.opacity * 0.65] }}
          transition={{
            duration: 2.8 + (index % 3) * 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: star.delay,
          }}
        >
          <FourPointStar size={star.size} />
        </motion.span>
      );
    })}
  </div>
);

export default HeroVisualDecor;
