import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./BrandLoader.css";

/**
 * TUNING CONFIG — Adjust all BrandLoader timings from this single object.
 * All durations are in seconds; thresholds are in milliseconds.
 */
export const LOADER_TIMING = {
  // Anti-flicker & readiness thresholds (ms)
  antiFlickerDelayMs: 150, // Never show if ready faster than this
  slowLoadThresholdMs: 8000, // Show "Taking longer than usual..." + Retry

  // Full intro build (~2.0s total)
  full: {
    tindahanDuration: 0.55,
    taglineLinesDuration: 0.45,
    tileDropDuration: 0.32,
    tileStagger: 0.035, // ~40ms stagger across 17 tiles
    tilesOverlap: "-=0.25", // Slight overlap with step 1
    letterDropDuration: 0.35,
    letterStagger: 0.11,
    cursorPopDuration: 0.2,
    cursorClickDuration: 0.15,
    tagSwingDuration: 0.45,
    exitDuration: 0.45,
  },

  // Compact variant (~0.9s build, ~0.3s exit) for repeat loads in same session
  compact: {
    timeScale: 2.2,
    exitDuration: 0.3,
  },

  // Fast-forward multiplier when app becomes ready mid-build
  fastForwardTimeScale: 2.5,

  // Calm idle shine sweep interval (seconds)
  idleShineDuration: 0.75,
  idleShineRepeatDelay: 1.6,

  // Reduced-motion fade duration (seconds)
  reducedMotionFade: 0.2,
} as const;

const SESSION_KEY = "rtu_tindahan_intro_seen";

// 17 awning tiles sampled left-to-right from the RTU Tindahan logo
const AWNING_COLORS = [
  "#ffbd59", "#c25959", "#ffffff",
  "#ffbd59", "#c25959", "#ffffff",
  "#ffbd59", "#c25959", "#ffffff",
  "#ffbd59", "#c25959", "#ffffff",
  "#ffbd59", "#c25959", "#ffffff",
  "#ffbd59", "#c25959",
] as const;

export type BrandLoaderVariant = "full" | "compact" | "auto";

export interface BrandLoaderProps {
  /** True when the app/page data is still loading */
  isLoading: boolean;
  /** "auto" plays full on first session visit, compact on subsequent boots */
  variant?: BrandLoaderVariant;
  /** Optional retry callback for the 8s slow-load fallback */
  onRetry?: () => void;
  /** Called after the exit animation finishes and the loader unmounts */
  onExited?: () => void;
}

function getInitialVariant(variant: BrandLoaderVariant): "full" | "compact" {
  if (variant !== "auto") return variant;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) ? "compact" : "full";
  } catch {
    return "full";
  }
}

function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Ignore storage errors in restricted/private contexts
  }
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  isLoading,
  variant = "auto",
  onRetry,
  onExited,
}) => {
  const [resolvedVariant] = useState<"full" | "compact">(() =>
    getInitialVariant(variant)
  );
  const [shouldRender, setShouldRender] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [isSlowLoad, setIsSlowLoad] = useState<boolean>(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const buildTlRef = useRef<gsap.core.Timeline | null>(null);
  const idleTlRef = useRef<gsap.core.Timeline | null>(null);
  const buildCompletedRef = useRef<boolean>(false);
  const exitStartedRef = useRef<boolean>(false);
  const isLoadingRef = useRef<boolean>(isLoading);
  /** True on the very first render. On initial mount with isLoading=true we skip
   * the anti-flicker delay so the brand loader always shows on a fresh page load. */
  const initialMountRef = useRef(true);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // 1. Anti-flicker gate: don't mount overlay if loading finishes in < 150ms.
  // On initial mount with isLoading=true we show immediately — a full page reload
  // should always play the brand intro. Subsequent loading states (route changes,
  // data refetches) still get the 150ms debounce to avoid flicker.
  useEffect(() => {
    if (!isLoading) return;
    if (shouldRender) return;

    if (initialMountRef.current) {
      setShouldRender(true);
      initialMountRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (isLoadingRef.current) {
        setShouldRender(true);
      }
    }, LOADER_TIMING.antiFlickerDelayMs);

    return () => window.clearTimeout(timer);
  }, [isLoading, shouldRender]);

  // 2. Slow-load timer (8s)
  useEffect(() => {
    if (!shouldRender || !isLoading) {
      setIsSlowLoad(false);
      return;
    }

    const slowTimer = window.setTimeout(() => {
      if (isLoadingRef.current) {
        setIsSlowLoad(true);
      }
    }, LOADER_TIMING.slowLoadThresholdMs);

    return () => window.clearTimeout(slowTimer);
  }, [shouldRender, isLoading]);

  // 3. Scroll lock + aria-busy on #root while visible
  useEffect(() => {
    if (!shouldRender) return;

    const rootEl = document.getElementById("root");
    document.body.style.overflow = "hidden";
    rootEl?.setAttribute("aria-busy", "true");

    return () => {
      // Clear overflow so CSS (and the app's normal scrolling) takes over.
      document.body.style.removeProperty("overflow");
      rootEl?.removeAttribute("aria-busy");
    };
  }, [shouldRender]);

  // 4. Trigger exit animation helper
  const runExit = () => {
    if (exitStartedRef.current || !overlayRef.current || !stageRef.current) return;
    exitStartedRef.current = true;
    setIsExiting(true);
    idleTlRef.current?.kill();
    markIntroSeen();

    // Clear <body> inline navy styles immediately so the app's normal
    // background (var(--bg)) is already visible when the overlay fades out.
    // Doing this at the start of exit (not at onComplete) prevents a flash
    // of navy between the overlay disappearing and the styles clearing.
    const bodyEl = document.body;
    bodyEl.style.removeProperty("background-color");
    bodyEl.style.removeProperty("margin");
    bodyEl.style.removeProperty("height");
    bodyEl.style.removeProperty("overflow");

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const exitDuration = prefersReduced
      ? LOADER_TIMING.reducedMotionFade
      : resolvedVariant === "compact"
      ? LOADER_TIMING.compact.exitDuration
      : LOADER_TIMING.full.exitDuration;

    const tl = gsap.timeline({
      onComplete: () => {
        setShouldRender(false);
        setIsExiting(false);
        exitStartedRef.current = false;
        buildCompletedRef.current = false;
        onExited?.();
      },
    });

    if (prefersReduced) {
      tl.to(overlayRef.current, { opacity: 0, duration: exitDuration, ease: "power1.out" });
    } else {
      tl.to(stageRef.current, {
        y: -24,
        scale: 1.05,
        opacity: 0,
        duration: exitDuration * 0.8,
        ease: "power2.in",
      }).to(
        overlayRef.current,
        {
          opacity: 0,
          duration: exitDuration * 0.75,
          ease: "power2.out",
        },
        `-=${exitDuration * 0.45}`
      );
    }
  };

  // 5. GSAP Build & Idle Timeline (StrictMode-safe via gsap.context)
  useLayoutEffect(() => {
    if (!shouldRender || !overlayRef.current) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      if (prefersReduced) {
        // Reduced motion: show all elements statically, then fade the overlay in
        gsap.set([
          ".bl-tindahan",
          ".bl-tagline-text",
          ".bl-tagline-line-left",
          ".bl-tagline-line-right",
          ".bl-tile",
          ".bl-letter",
          ".bl-cursor",
          ".bl-tag-group",
          ".bl-shine",
        ], { opacity: 1, scaleX: 1, y: 0, x: 0, skewX: 0, rotation: 0, scale: 1, transformOrigin: "center center" });
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: LOADER_TIMING.reducedMotionFade,
            onComplete: () => {
              buildCompletedRef.current = true;
              if (!isLoadingRef.current) runExit();
            },
          }
        );
        return;
      }

      const cfg = LOADER_TIMING.full;

      // Initial hidden states (transform & opacity only)
      gsap.set(".bl-tindahan", { x: -70, skewX: -12, opacity: 0 });
      gsap.set(".bl-tagline-text", { opacity: 0, scale: 0.94, transformOrigin: "center center" });
      gsap.set(".bl-tagline-line-left", { scaleX: 0, transformOrigin: "right center" });
      gsap.set(".bl-tagline-line-right", { scaleX: 0, transformOrigin: "left center" });
      gsap.set(".bl-tile", { y: -32, scaleY: 0.75, opacity: 0, transformOrigin: "center bottom" });
      gsap.set(".bl-awning-group", { transformOrigin: "center bottom" });
      gsap.set(".bl-letter", { y: -70, opacity: 0, transformOrigin: "center bottom" });
      gsap.set(".bl-cursor", { scale: 0, opacity: 0, transformOrigin: "20% 20%" });
      gsap.set(".bl-tag-group", { rotation: -28, opacity: 0, transformOrigin: "100% 0%" });
      gsap.set(".bl-shine", { x: -460, opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () => {
          buildCompletedRef.current = true;
          if (!isLoadingRef.current) {
            runExit();
          } else {
            // Calm idle state: soft shine sweep across the awning every ~1.6s
            idleTlRef.current = gsap
              .timeline({ repeat: -1, repeatDelay: LOADER_TIMING.idleShineRepeatDelay })
              .fromTo(
                ".bl-shine",
                { x: -460, opacity: 0 },
                {
                  x: 520,
                  opacity: 0.45,
                  duration: LOADER_TIMING.idleShineDuration,
                  ease: "power1.inOut",
                }
              )
              .to(".bl-shine", { opacity: 0, duration: 0.15 }, "-=0.15");
          }
        },
      });

      // STEP 1: TINDAHAN rushes in + tagline lines draw outward from center
      tl.to(".bl-tindahan", {
        x: 0,
        skewX: 0,
        opacity: 1,
        duration: cfg.tindahanDuration,
        ease: "power3.out",
      })
        .to(
          ".bl-tagline-text",
          { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" },
          `-=${cfg.tindahanDuration * 0.5}`
        )
        .to(
          [".bl-tagline-line-left", ".bl-tagline-line-right"],
          { scaleX: 1, opacity: 1, duration: cfg.taglineLinesDuration, ease: "power2.out" },
          `-=${cfg.tindahanDuration * 0.45}`
        );

      // STEP 2: 17 Awning tiles drop left-to-right with overshoot + squash
      tl.to(
        ".bl-tile",
        {
          y: 0,
          scaleY: 1,
          opacity: 1,
          duration: cfg.tileDropDuration,
          stagger: cfg.tileStagger,
          ease: "back.out(1.6)",
        },
        cfg.tilesOverlap
      ).to(
        ".bl-tag-group",
        {
          rotation: 0,
          opacity: 1,
          duration: cfg.tagSwingDuration,
          ease: "elastic.out(1, 0.45)",
        },
        "-=0.35"
      );

      // STEP 3: R drops first, lands on awning with bounce
      tl.to(".bl-letter-r", {
        y: 0,
        opacity: 1,
        duration: cfg.letterDropDuration,
        ease: "bounce.out",
      }, "+=0.1")
        .to(".bl-awning-group", {
          scaleY: 0.94,
          duration: 0.07,
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut",
        }, "-=0.15")
        // T drops after R settles
        .to(".bl-letter-t", {
          y: 0,
          opacity: 1,
          duration: cfg.letterDropDuration,
          ease: "bounce.out",
        }, "+=" + cfg.letterDropDuration)
        .to(".bl-awning-group", {
          scaleY: 0.94,
          duration: 0.07,
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut",
        }, "-=0.15")
        // U drops after T settles
        .to(".bl-letter-u", {
          y: 0,
          opacity: 1,
          duration: cfg.letterDropDuration,
          ease: "bounce.out",
        }, "+=" + cfg.letterDropDuration)
        .to(".bl-awning-group", {
          scaleY: 0.94,
          duration: 0.07,
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut",
        }, "-=0.15");

      // STEP 4: Cursor arrow pops in and performs a single "click" press
      tl.to(
        ".bl-cursor",
        {
          scale: 1,
          opacity: 1,
          duration: cfg.cursorPopDuration,
          ease: "back.out(2)",
        },
        "-=0.1"
      ).to(".bl-cursor", {
        scale: 0.84,
        duration: cfg.cursorClickDuration * 0.5,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      });

      if (resolvedVariant === "compact") {
        tl.timeScale(LOADER_TIMING.compact.timeScale);
      }

      buildTlRef.current = tl;
    }, overlayRef);

    return () => {
      buildTlRef.current = null;
      idleTlRef.current = null;
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, resolvedVariant]);

  // 6. Adaptive speed: fast-forward if loading finishes mid-build, or exit immediately if idle
  useEffect(() => {
    if (!shouldRender || isLoading) return;

    if (buildCompletedRef.current) {
      runExit();
    } else if (buildTlRef.current) {
      buildTlRef.current.timeScale(LOADER_TIMING.fastForwardTimeScale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      ref={overlayRef}
      className={`brand-loader-overlay${isExiting ? " brand-loader-overlay--exiting" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="bl-sr-only">Loading RTU Tindahan</span>

      <div ref={stageRef} className="brand-loader-stage">
        <svg
          className="brand-loader-svg"
          viewBox="0 0 600 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Clip path for the idle shine sweep across the 17-tile awning */}
            <clipPath id="bl-awning-clip">
              <rect x="82" y="166" width="436" height="46" rx="8" />
            </clipPath>
            <linearGradient id="bl-shine-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* LAYER 1: R, T, U Letters (sit directly on top of the awning) */}
          <g className="bl-letters-group">
            {/* R */}
            <g className="bl-letter bl-letter-r">
              <path
                d="M126 170V54C126 48.5 130.5 44 136 44H188C214 44 231 59 231 83C231 101 221 114 205 119L232 170H197L174 124H158V170H126ZM158 98H184C194 98 200 92 200 83C200 74 194 69 184 69H158V98Z"
                fill="#ffffff"
              />
            </g>
            {/* T */}
            <g className="bl-letter bl-letter-t">
              <path
                d="M258 44H352C357.5 44 362 48.5 362 54V66C362 71.5 357.5 76 352 76H322V170H288V76H258C252.5 76 248 71.5 248 66V54C248 48.5 252.5 44 258 44Z"
                fill="#ffffff"
              />
            </g>
            {/* U */}
            <g className="bl-letter bl-letter-u">
              <path
                d="M388 44H412C417.5 44 422 48.5 422 54V124C422 138 431 146 444 146C457 146 466 138 466 124V54C466 48.5 470.5 44 476 44H500C505.5 44 510 48.5 510 54V126C510 156 484 174 444 174C404 174 378 156 378 126V54C378 48.5 382.5 44 388 44Z"
                fill="#ffffff"
              />
            </g>
          </g>

          {/* LAYER 2: Cursor Arrow overlapping the T */}
          <g className="bl-cursor">
            <path
              d="M306 116L348 134L332 141L344 156L334 164L322 149L315 163L306 116Z"
              fill="#ffbd59"
            />
          </g>

          {/* LAYER 3: 17-Tile Awning + Idle Shine Sweep */}
          <g className="bl-awning-group">
            {AWNING_COLORS.map((color, i) => {
              const x = 86 + i * 25.2;
              const skew = (i - 8) * 1.1; // Subtle outward perspective fan
              return (
                <path
                  key={i}
                  className="bl-tile"
                  d={`M${x + skew * 0.4} 168 H${x + 25.2 + skew * 0.4} L${x + 25.2 + skew} 196 A12.6 12.6 0 0 1 ${x + skew} 196 Z`}
                  fill={color}
                />
              );
            })}

            {/* Idle Shine Overlay */}
            <g clipPath="url(#bl-awning-clip)">
              <rect
                className="bl-shine"
                x="80"
                y="160"
                width="90"
                height="60"
                fill="url(#bl-shine-grad)"
                transform="skewX(-20)"
              />
            </g>
          </g>

          {/* LAYER 4: Price Tag + String (left side) */}
          <g className="bl-tag-group">
            <path
              d="M90 198 C78 214, 108 232, 96 254 C90 264, 80 266, 76 266"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M78 265 L98 294"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <g transform="translate(46, 252) rotate(-18)">
              <path
                d="M6 0 H30 L42 13 L30 26 H6 A6 6 0 0 1 0 20 V6 A6 6 0 0 1 6 0 Z"
                fill="#c25959"
              />
              <circle cx="31" cy="13" r="3.2" fill="#1a2f57" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </g>

          {/* LAYER 5: TINDAHAN Wordmark */}
          <g className="bl-tindahan">
            <text
              x="300"
              y="264"
              textAnchor="middle"
              fill="#ffbd59"
              fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              fontWeight="900"
              fontSize="64"
              letterSpacing="5"
            >
              TINDAHAN
            </text>
          </g>

          {/* LAYER 6: CAMPUS MARKETPLACE + Side Lines */}
          <g className="bl-tagline-group">
            <line
              className="bl-tagline-line bl-tagline-line-left"
              x1="88"
              y1="296"
              x2="164"
              y2="296"
              stroke="#ffbd59"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              className="bl-tagline-text"
              x="300"
              y="301"
              textAnchor="middle"
              fill="#ffffff"
              fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
              fontWeight="700"
              fontSize="16"
              letterSpacing="3.5"
            >
              CAMPUS MARKETPLACE
            </text>
            <line
              className="bl-tagline-line bl-tagline-line-right"
              x1="436"
              y1="296"
              x2="512"
              y2="296"
              stroke="#ffbd59"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {isSlowLoad && (
        <div className="brand-loader-slow">
          <span>Taking longer than usual…</span>
          <button
            type="button"
            className="brand-loader-retry"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
