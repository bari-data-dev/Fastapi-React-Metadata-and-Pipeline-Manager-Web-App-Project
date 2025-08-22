// src/components/ui/toaster.tsx
import React from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { CheckCircle, AlertCircle, Info } from "lucide-react";

/**
 * Toaster renderer.
 *
 * This component is intentionally permissive about the toast shape returned
 * by `useToast()` because different projects/type-definitions may vary.
 *
 * The only assumptions:
 *  - each toast has an `id` (string | number)
 *  - optional `title` (ReactNode)
 *  - optional `description` (ReactNode)
 *  - optional `action` (ReactNode)
 *  - optional `variant` ("default" | "destructive" | "success" | "info")
 *
 * Destructive (error) toasts get longer duration (15s) to make them easier to read.
 */

type ToastVariant = "default" | "destructive" | "success" | "info";

export function Toaster() {
  // toasts may not have a strict shape, so use `any` here and narrow below.
  const { toasts } = useToast() as { toasts: any[] };

  return (
    // keep provider duration; you previously set it (e.g. 750ms). We keep that.
    <ToastProvider duration={750}>
      {toasts.map((t: any) => {
        // normalize fields with safe fallbacks
        const id = t.id ?? Math.random().toString(36).slice(2);
        const title: React.ReactNode = t.title ?? undefined;
        const description: React.ReactNode = t.description ?? undefined;
        const action: React.ReactNode = t.action ?? undefined;
        const variant: ToastVariant = (t.variant as ToastVariant) ?? "default";

        // icon selection
        let Icon = Info;
        if (variant === "destructive") Icon = AlertCircle;
        else if (variant === "success") Icon = CheckCircle;

        // override duration (ms) for destructive (error) toasts only
        const durationForThisToast = variant === "destructive" ? 2500 : undefined;

        // animation duration inline style for progress bar
        const progressStyle =
          durationForThisToast !== undefined ? { animationDuration: `${durationForThisToast}ms` } : undefined;

        return (
          <Toast
            // Radix `Toast.Root` accepts `duration` prop; our Toast wrapper passes it along
            key={String(id)}
            variant={variant}
            duration={durationForThisToast}
            // allow data-attribute if you want to style by variant
            data-variant={variant}
            // pass other props spread (if any). This keeps compatibility with existing useToast metadata.
            {...t}
            className="max-w-xs sm:max-w-sm p-3 shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon className={variant === "destructive" ? "h-5 w-5 text-white" : "h-5 w-5"} />
              </div>

              <div className="min-w-0 flex-1">
                {title && (
                  <ToastTitle className={variant === "destructive" ? "text-white" : ""}>
                    {title}
                  </ToastTitle>
                )}

                {description && (
                  <ToastDescription className={variant === "destructive" ? "text-white" : ""}>
                    {description}
                  </ToastDescription>
                )}
              </div>
            </div>

            {action && <div className="ml-2 flex items-center">{action}</div>}

            <ToastClose className="ml-2 p-1" />

            {/* progress bar (animated shrink) */}
            <div className="absolute left-0 bottom-0 h-1 w-full overflow-hidden rounded-b-md" aria-hidden>
              <div
                style={progressStyle}
                className={
                  `h-full origin-left transform bg-white/80 dark:bg-white/60 animate-progress ` +
                  (variant === "destructive" ? "bg-white/90" : "")
                }
              />
            </div>
          </Toast>
        );
      })}

      <ToastViewport className="pointer-events-none" />
    </ToastProvider>
  );
}
