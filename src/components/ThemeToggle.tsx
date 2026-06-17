import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
  iconClassName?: string;
  yellowSun?: boolean;
}

export function ThemeToggle({ className, iconClassName, yellowSun = false }: ThemeToggleProps) {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark(!dark)}
      className={cn("rounded-full w-9 h-9 min-h-0 min-w-0", className)}
      aria-label="تبديل الوضع"
    >
      {dark ? (
        <Sun className={cn("h-4 w-4", iconClassName, yellowSun && "text-yellow-500 fill-yellow-500/25")} />
      ) : (
        <Moon className={cn("h-4 w-4", iconClassName, yellowSun && "text-yellow-600 fill-yellow-500/20")} />
      )}
    </Button>
  );
}
