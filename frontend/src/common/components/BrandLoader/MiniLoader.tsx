import React, { useEffect, useRef, useState } from "react";
import "./BrandLoader.css";

const MINI_TILES = ["gold", "red", "white", "gold", "red"] as const;

export interface MiniLoaderProps {
  /** Controls whether loading is active (built-in 200ms delay & 400ms min duration) */
  isLoading?: boolean;
  /** "inline" for buttons, "section" for page/card content areas */
  variant?: "inline" | "section";
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export const MiniLoader: React.FC<MiniLoaderProps> = ({
  isLoading = true,
  variant = "inline",
  size = "md",
  label,
  className = "",
}) => {
  // Inline button spinners show immediately; section loaders use 200ms anti-flicker delay
  const [visible, setVisible] = useState<boolean>(variant === "inline" && isLoading);
  const shownAtRef = useRef<number>(variant === "inline" && isLoading ? Date.now() : 0);

  useEffect(() => {
    if (variant === "inline") {
      setVisible(isLoading);
      return;
    }

    if (isLoading) {
      const showTimer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, 200);
      return () => window.clearTimeout(showTimer);
    }

    if (visible) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, 400 - elapsed);
      const hideTimer = window.setTimeout(() => setVisible(false), remaining);
      return () => window.clearTimeout(hideTimer);
    }
  }, [isLoading, variant, visible]);

  if (!visible) return null;

  return (
    <span
      className={`mini-loader mini-loader--${variant} mini-loader--${size} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="mini-loader-tiles" aria-hidden="true">
        {MINI_TILES.map((color, idx) => (
          <span
            key={idx}
            className={`mini-loader-tile mini-loader-tile--${color}`}
            style={{ animationDelay: `${idx * 90}ms` }}
          />
        ))}
      </span>
      {label ? (
        <span className="mini-loader-label">{label}</span>
      ) : (
        <span className="bl-sr-only">Loading…</span>
      )}
    </span>
  );
};
