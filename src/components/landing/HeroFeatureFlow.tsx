import { motion } from 'framer-motion';

import type { LucideIcon } from 'lucide-react';

import { ShoppingBag, TrendingUp, Truck, User } from 'lucide-react';

import DashboardMockup from '@/components/landing/DashboardMockup';



type SideCardAccent = 'primary' | 'emerald' | 'orange';



type SideCard = {

  id: string;

  corner: 'lt' | 'rt' | 'lb' | 'rb';

  title: string;

  line1: string;

  line2: string;

  icon: LucideIcon;

  accent: SideCardAccent;

};



const sideCards: SideCard[] = [

  {

    id: 'new-order',

    corner: 'lt',

    title: 'طلب جديد',

    line1: '45,000 د.ع',

    line2: 'منذ دقيقة واحدة',

    icon: ShoppingBag,

    accent: 'primary',

  },

  {

    id: 'sales-up',

    corner: 'rt',

    title: 'ارتفاع المبيعات',

    line1: '+18%',

    line2: 'هذا الأسبوع',

    icon: TrendingUp,

    accent: 'emerald',

  },

  {

    id: 'shipped',

    corner: 'lb',

    title: 'تم شحن طلب',

    line1: '#1248',

    line2: 'منذ 5 دقائق',

    icon: Truck,

    accent: 'emerald',

  },

  {

    id: 'new-customer',

    corner: 'rb',

    title: 'عميل جديد',

    line1: 'سارة أحمد',

    line2: 'منذ 3 دقائق',

    icon: User,

    accent: 'orange',

  },

];



type HeroFeatureFlowProps = {

  animate?: boolean;

  statsBar?: React.ReactNode;

};



const accentDotClass: Record<SideCardAccent, string> = {

  primary: 'lp-side-card-dot--primary',

  emerald: 'lp-side-card-dot--emerald',

  orange: 'lp-side-card-dot--orange',

};



const accentIconClass: Record<SideCardAccent, string> = {

  primary: 'lp-side-card-icon--primary',

  emerald: 'lp-side-card-icon--emerald',

  orange: 'lp-side-card-icon--orange',

};



const accentLineClass: Record<SideCardAccent, string> = {

  primary: 'lp-side-card-line--primary',

  emerald: 'lp-side-card-line--emerald',

  orange: 'lp-side-card-line--orange',

};



const SideNotificationCard = ({

  card,

  animate,

  compact = false,

}: {

  card: SideCard;

  animate: boolean;

  compact?: boolean;

}) => {

  const Icon = card.icon;

  const content = (

    <div

      className={`lp-side-card lp-side-card--${card.corner}${compact ? ' lp-side-card--compact' : ''}`}

      dir="rtl"

    >

      <span className={`lp-side-card-dot ${accentDotClass[card.accent]}`} aria-hidden />

      <div className="lp-side-card-body">

        <p className="lp-side-card-title">{card.title}</p>

        <p className={`lp-side-card-line ${accentLineClass[card.accent]}`}>{card.line1}</p>

        {!compact && <p className="lp-side-card-meta">{card.line2}</p>}

      </div>

      <span className={`lp-side-card-icon ${accentIconClass[card.accent]}`} aria-hidden>

        <Icon className="h-4 w-4" strokeWidth={2} />

      </span>

    </div>

  );



  if (!animate) return content;



  return (

    <motion.div

      initial={false}

      animate={{ y: [0, -4, 0] }}

      transition={{

        duration: 5.2,

        repeat: Infinity,

        ease: 'easeInOut',

        delay: sideCards.indexOf(card) * 0.35,

      }}

    >

      {content}

    </motion.div>

  );

};



const GlowNode = ({ cx, cy }: { cx: number; cy: number }) => (

  <g>

    <circle cx={cx} cy={cy} r="8" fill="currentColor" opacity="0.06" />

    <circle cx={cx} cy={cy} r="4.5" fill="currentColor" opacity="0.14" />

    <circle cx={cx} cy={cy} r="2" fill="currentColor" opacity="0.65" />

  </g>

);



const DesktopFeaturePath = () => (
  <svg
    className="lp-hero-feature-path lp-hero-feature-path--desktop"
    viewBox="0 0 1200 560"
    fill="none"
    preserveAspectRatio="none"
    aria-hidden
  >
    {/* Top-left card → upper-left dashboard edge */}
    <path
      className="lp-hero-feature-path-line"
      d="M118 108 C210 96, 310 120, 420 150 C480 168, 530 182, 560 192"
    />

    {/* Top-right card → upper-right dashboard edge */}
    <path
      className="lp-hero-feature-path-line"
      d="M1082 118 C990 104, 890 128, 780 156 C720 174, 670 186, 640 194"
    />

    {/* Bottom-left card → lower-left dashboard edge */}
    <path
      className="lp-hero-feature-path-line"
      d="M136 408 C220 388, 320 362, 400 348 C470 336, 520 330, 568 328"
    />

    {/* Bottom-right card → lower-right dashboard edge */}
    <path
      className="lp-hero-feature-path-line"
      d="M1064 402 C980 382, 880 358, 800 344 C730 332, 680 328, 632 326"
    />

    {/* Card endpoints */}
    <GlowNode cx={118} cy={108} />
    <GlowNode cx={1082} cy={118} />
    <GlowNode cx={136} cy={408} />
    <GlowNode cx={1064} cy={402} />

    {/* Dashboard junction points */}
    <GlowNode cx={560} cy={192} />
    <GlowNode cx={640} cy={194} />
    <GlowNode cx={568} cy={328} />
    <GlowNode cx={632} cy={326} />
  </svg>
);



/** Desktop-only composition — unchanged from reference layout */

const DesktopComposition = ({ animate }: { animate: boolean }) => (
  <div className="lp-hero-connectors-stage">
    <DesktopFeaturePath />

    <div className="lp-hero-visual-composition">

      {sideCards.map((card) => (

        <div key={card.id} className={`lp-hero-corner lp-hero-corner--${card.corner}`}>

          <SideNotificationCard card={card} animate={animate} />

        </div>

      ))}

      <div className="lp-hero-dashboard-wrap">

        <DashboardMockup variant="desktop" />

      </div>

    </div>
  </div>
);



/** Purpose-built mobile showcase — full-width dashboard only (no side floats) */
const MobileComposition = ({ statsBar }: { statsBar?: React.ReactNode }) => (
  <div className="lp-hero-mobile-composition">
    <div className="lp-hero-mobile-showcase">
      <div className="lp-hero-mobile-dashboard">
        <DashboardMockup variant="mobile" />
      </div>
    </div>
    {statsBar}
  </div>
);



const HeroFeatureFlow = ({ animate = true, statsBar }: HeroFeatureFlowProps) => (

  <div className="lp-hero-visual-stage">

    <div className="lp-hero-desktop-layer hidden md:block">

      <DesktopComposition animate={animate} />

      {statsBar}

    </div>



    <div className="lp-hero-mobile-layer md:hidden">

      <MobileComposition statsBar={statsBar} />

    </div>

  </div>

);



export default HeroFeatureFlow;


