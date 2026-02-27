import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  animation?: "fade-in-up" | "slide-up" | "scale-bounce";
}

const ScrollReveal = ({ children, delay = 0, className, animation = "fade-in-up" }: ScrollRevealProps) => {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-none",
        isVisible ? `animate-${animation}` : "opacity-0 translate-y-[30px]",
        className
      )}
      style={isVisible && delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: "forwards" } : isVisible ? { animationFillMode: "forwards" } : { opacity: 0 }}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
