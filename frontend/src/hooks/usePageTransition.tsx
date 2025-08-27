import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

// Define page order based on sidebar structure
const PAGE_ORDER = [
  "/", // Index page
  "/dashboard", // Analytics section
  "/metadata/clients", // Metadata section
  "/metadata/config",
  "/metadata/mapping",
  "/metadata/required",
  "/metadata/transform",
  "/metadata/integrations",
  "/metadata/integration-dependencies",
  "/metadata/mv-refresh",
  "/audit/files", // Audit section
  "/audit/jobs",
  "/audit/mapping",
  "/audit/rows",
  "/audit/errors",
  "/audit/transform",
  "/audit/integration-logs",
  "/audit/mv-refresh-logs",
];

export type TransitionDirection = "slide-up" | "slide-down" | "none";

export function usePageTransition() {
  const location = useLocation();
  const [direction, setDirection] = useState<TransitionDirection>("none");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const currentIndex = PAGE_ORDER.indexOf(location.pathname);
    const prevPath = sessionStorage.getItem("prevPath");
    const prevIndex = prevPath ? PAGE_ORDER.indexOf(prevPath) : -1;

    if (prevIndex !== -1 && currentIndex !== -1) {
      if (currentIndex > prevIndex) {
        setDirection("slide-up"); // Moving down in the list = slide up animation
      } else if (currentIndex < prevIndex) {
        setDirection("slide-down"); // Moving up in the list = slide down animation
      } else {
        setDirection("none");
      }
    } else {
      setDirection("none");
    }

    setIsTransitioning(true);

    // Store current path for next transition
    sessionStorage.setItem("prevPath", location.pathname);

    // Reset transition state after animation
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      setDirection("none");
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return { direction, isTransitioning };
}
