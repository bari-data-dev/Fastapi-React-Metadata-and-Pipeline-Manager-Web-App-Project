import { ReactNode } from "react";
import {
  usePageTransition,
  TransitionDirection,
} from "@/hooks/usePageTransition";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
}

const getTransitionClasses = (
  direction: TransitionDirection,
  isTransitioning: boolean
) => {
  const baseClasses =
    "w-full h-full transition-transform duration-300 ease-in-out";

  if (!isTransitioning) {
    return cn(baseClasses, "transform-none");
  }

  switch (direction) {
    case "slide-up":
      return cn(baseClasses, "animate-slide-in-from-bottom");
    case "slide-down":
      return cn(baseClasses, "animate-slide-in-from-top");
    default:
      return cn(baseClasses, "animate-fade-in");
  }
};

export function PageTransition({ children }: PageTransitionProps) {
  const { direction, isTransitioning } = usePageTransition();

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className={getTransitionClasses(direction, isTransitioning)}>
        {children}
      </div>
    </div>
  );
}
