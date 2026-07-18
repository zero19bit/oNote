import { useEffect, useRef, useState } from "react";
import { NOTE_COLORS, NoteColor } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NoteColorPickerProps {
  value: NoteColor;
  onChange: (color: NoteColor) => void;
  /** Render mode: "icon" = a small color dot that opens a popover;
   *  "inline" = always-open swatches row (useful for the editor toolbar). */
  variant?: "icon" | "inline";
  className?: string;
}

/**
 * Apple-Notes-style color picker. Two variants:
 *  - "icon"   — a single swatch button that opens a popover with all colors.
 *  - "inline" — always-visible row of swatches, no popover.
 *
 * Click-outside closes the popover. The currently-selected swatch is
 * marked with a ring so you can see the current state at a glance.
 */
export function NoteColorPicker({
  value,
  onChange,
  variant = "icon",
  className,
}: NoteColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = NOTE_COLORS.find((c) => c.id === value) ?? NOTE_COLORS[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {NOTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={`Color: ${c.label}`}
            onClick={() => onChange(c.id)}
            className={cn(
              "w-5 h-5 rounded-full border border-border transition-transform",
              c.dot,
              value === c.id ? "ring-2 ring-fg scale-110" : "hover:scale-110"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        type="button"
        title={`Color: ${current.label}`}
        aria-label="Change note color"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-6 h-6 rounded-full border border-border transition-transform hover:scale-110",
          current.dot,
          open && "ring-2 ring-fg scale-110"
        )}
      />
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 surface-elevated p-1.5 flex items-center gap-1 shadow-card"
          style={{ minWidth: "max-content" }}
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={value === c.id}
              title={c.label}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className={cn(
                "w-6 h-6 rounded-full border border-border transition-transform",
                c.dot,
                value === c.id ? "ring-2 ring-fg scale-110" : "hover:scale-110"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
