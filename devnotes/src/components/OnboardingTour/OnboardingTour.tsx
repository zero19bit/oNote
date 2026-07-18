import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useUI } from "@/store/ui";
import { tourSteps, type TourStep, type TourStepPlacement } from "./tourSteps";
import { cn, shortcutKeys } from "@/lib/utils";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 360;
const CARD_GAP = 16;     // distance between target and card
const VIEWPORT_PAD = 16; // keep card this far from viewport edges

/**
 * Translate a logical placement (start/end) into a visual one based on the
 * current text direction. We also flip the explicit "right"/"left" choices
 * when running in RTL, so that "right" always means "toward the user's
 * reading-end" (right in LTR, left in RTL).
 */
function resolvePlacement(
  placement: TourStepPlacement,
  dir: "ltr" | "rtl"
): "right" | "left" | "top" | "bottom" | "center" {
  if (placement === "center" || placement === "top" || placement === "bottom") {
    return placement;
  }
  if (dir === "rtl") {
    return placement === "right" ? "left" : "right";
  }
  return placement;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function computeCardPosition(
  placement: "right" | "left" | "top" | "bottom" | "center",
  rect: TargetRect | null,
  vw: number,
  vh: number
): { top: number; left: number } {
  if (!rect || placement === "center") {
    return {
      top: Math.max(VIEWPORT_PAD, (vh - 260) / 2),
      left: Math.max(VIEWPORT_PAD, (vw - CARD_WIDTH) / 2),
    };
  }
  let top = 0;
  let left = 0;

  switch (placement) {
    case "right":
      top = rect.top;
      left = rect.left + rect.width + CARD_GAP;
      break;
    case "left":
      top = rect.top;
      left = rect.left - CARD_WIDTH - CARD_GAP;
      break;
    case "bottom":
      top = rect.top + rect.height + CARD_GAP;
      left = rect.left;
      break;
    case "top":
      top = rect.top - CARD_GAP - 240;
      left = rect.left;
      break;
  }

  top = clamp(top, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vh - 280));
  left = clamp(left, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, vw - CARD_WIDTH - VIEWPORT_PAD));
  return { top, left };
}

export function OnboardingTour() {
  const open = useUI((s) => s.tourOpen);
  const stepIndex = useUI((s) => s.tourStep);
  const next = useUI((s) => s.nextTourStep);
  const prev = useUI((s) => s.prevTourStep);
  const end = useUI((s) => s.endTour);
  const direction = useUI((s) => s.direction);
  const platform = useUI((s) => s.platform);

  const [rect, setRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const programmaticScroll = useRef(false);

  const step = tourSteps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tourSteps.length - 1;

  // Measure viewport + target rect on step change and on resize.
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      if (!step?.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };

    measure();

    // Scroll target into view if it exists. Only on step change so we don't
    // fight the user's own scrolling.
    if (step?.target) {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        programmaticScroll.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setTimeout(() => {
          programmaticScroll.current = false;
        }, 600);
      }
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIndex, step?.target]);

  // Lock background scroll while the tour is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Keyboard nav: Esc = skip, ArrowRight/Enter = next, ArrowLeft = prev.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        end(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) end(true);
        else next();
      } else if (e.key === "ArrowLeft" && !isFirst) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isFirst, isLast, next, prev, end]);

  const visualPlacement = useMemo(
    () => resolvePlacement(step?.placement ?? "center", direction),
    [step?.placement, direction]
  );

  const cardPos = useMemo(
    () => computeCardPosition(visualPlacement, rect, viewport.w, viewport.h),
    [visualPlacement, rect, viewport.w, viewport.h]
  );

  if (!open || !step) return null;

  const hasTarget = Boolean(step.target) && rect !== null;
  const spotlightStyle: React.CSSProperties | undefined = hasTarget
    ? {
        top: (rect!.top - 6) + "px",
        left: (rect!.left - 6) + "px",
        width: (rect!.width + 12) + "px",
        height: (rect!.height + 12) + "px",
      }
    : undefined;

  const Icon = step.icon;
  // When the user has toggled RTL, render the card's content RTL too so any
  // mixed Persian/English content reads naturally. The visual placement of
  // the card is already direction-aware via resolvePlacement.
  const cardDir = direction;

  // In RTL, flip the iconography on the nav buttons so the arrow always
  // points "forward" relative to the reading direction.
  const PrevIcon = direction === "rtl" ? ArrowLeft : ArrowRight;
  const NextIcon = direction === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
    >
      {/* Backdrop + spotlight */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          hasTarget ? "bg-black/70" : "bg-black/80"
        )}
        onClick={() => end(true)}
      />

      {hasTarget && (
        <div
          className="absolute rounded-2xl ring-2 ring-accent shadow-glow transition-all duration-200 ease-out"
          style={{
            ...spotlightStyle,
            boxShadow:
              "0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 1px rgba(34,211,238,0.5), 0 0 24px -4px rgba(34,211,238,0.5)",
          }}
        />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        dir={cardDir}
        className="absolute w-[360px] max-w-[calc(100vw-32px)] surface-elevated shadow-card animate-fade-in"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold leading-tight" dir="auto">
              {step.title}
            </h2>
            <p className="text-[11px] text-fg-muted mt-0.5">
              Step {stepIndex + 1} of {tourSteps.length}
            </p>
          </div>
          <button
            onClick={() => end(false)}
            className="text-fg-subtle hover:text-fg transition-colors p-1 -m-1"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-fg-muted leading-relaxed" dir="auto">
            {step.description}
          </p>
          {step.hint && (
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span>{step.hint.label}:</span>
              <span className="flex items-center gap-1">
                {shortcutKeys(platform, ...step.hint.keys).map((k, i) => (
                  <span key={i} className="kbd">
                    {k}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border bg-bg-surface/40 rounded-b-xl">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === stepIndex
                    ? "w-4 bg-accent"
                    : i < stepIndex
                    ? "w-1.5 bg-accent/40"
                    : "w-1.5 bg-bg-elevated"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {!isFirst && (
              <button onClick={prev} className="btn-ghost text-xs">
                <PrevIcon size={12} />
                Back
              </button>
            )}
            {isLast ? (
              <button onClick={() => end(true)} className="btn-primary text-xs">
                Get started
                <NextIcon size={12} />
              </button>
            ) : (
              <button onClick={next} className="btn-primary text-xs">
                Next
                <NextIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
