import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Banderitas } from "@/common/components/Banderitas"
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

  // Fast-forward multiplier when app becomes ready mid-build (legacy fallback)
  fastForwardTimeScale: 3.5,

  // Adaptive exit durations based on actual load speed (seconds)
  adaptiveExitFast: 0.24,   // < 400ms load
  adaptiveExitNormal: 0.32, // 400–1200ms load
  adaptiveExitSlow: 0.42,   // > 1200ms load

  // Fiesta banderitas: wrapper divs drop in staggered, never flags/SVG
  bunting: {
    dropDuration: 0.7,
    topStart: 0.1,
    lowStart: 0.3,
    bottomStart: 0.45,
    dropDistance: 90, // px
  },

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
  /** GSAP timeScale multiplier for build & exit (1 = normal, 2 = 2x faster, etc.) */
  timeScale?: number;
  /** Bypass the 150ms anti-flicker delay and show immediately (e.g. login flow) */
  immediate?: boolean;
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
  timeScale = 1,
  immediate = false,
}) => {
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
  /** Recorded the moment shouldRender becomes true — used to compute elapsed load time. */
  const loadStartMsRef = useRef<number>(0);
  /** True on the very first render. On initial mount with isLoading=true we skip
   * the anti-flicker delay so the brand loader always shows on a fresh page load. */
  const initialMountRef = useRef(true);
  /** Prop refs — updated via effects so the build effect (which depends only on
   * shouldRender) always reads the latest props without re-running. */
  const variantRef = useRef<BrandLoaderVariant>(variant);
  const onExitedRef = useRef<(() => void) | undefined>(onExited);
  const timeScaleRef = useRef<number>(timeScale);
  /** Adaptive exit duration in seconds, set by accelerateToFinish(). */
  const adaptiveExitSecRef = useRef<number>(0.32);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Keep prop refs in sync so the build effect (which depends only on shouldRender)
  // always reads the latest props without re-running.
  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);
  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);
  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  // 1. Anti-flicker gate: don't mount overlay if loading finishes in < 150ms.
  // On initial mount with isLoading=true we show immediately — a full page reload
  // should always play the brand intro. When `immediate` is true (login flow) we
  // also bypass the delay so fast logins don't delay or skip the animation.
  // Subsequent loading states (route changes, data refetches) still get the
  // 150ms debounce to avoid flicker.
  useEffect(() => {
    if (!isLoading) return;
    if (shouldRender) return;

    if (initialMountRef.current || immediate) {
      loadStartMsRef.current = Date.now();
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
  }, [isLoading, shouldRender, immediate]);

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
      // Always clear the inline navy background so the app's CSS background
      // (var(--bg)) shows through even if the exit animation never ran.
      document.body.style.removeProperty("background-color");
      document.body.style.removeProperty("margin");
      document.body.style.removeProperty("height");
    };
  }, [shouldRender]);

  // 7. Safety net: if the loader stays visible for more than 10 seconds
  //    (e.g. auth/restore or listings fetch is hung), force the exit so the
  //    user is never trapped behind a blank navy overlay.
  useEffect(() => {
    if (!shouldRender || !isLoading) return;
    const safetyTimer = window.setTimeout(() => {
      runExit(0.2);
    }, 10000);
    return () => window.clearTimeout(safetyTimer);
  }, [shouldRender, isLoading]);

  // 4. Trigger exit animation helper
  const runExit = (adaptiveExitDuration?: number) => {
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

    let exitDuration: number;
    if (prefersReduced) {
      exitDuration = LOADER_TIMING.reducedMotionFade;
    } else if (adaptiveExitDuration !== undefined) {
      exitDuration = adaptiveExitDuration;
    } else {
      exitDuration = adaptiveExitSecRef.current || 0.32;
    }

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
  //    Depends ONLY on [shouldRender] so prop changes (variant/timeScale/onExited)
  //    when isSigningIn flips never trigger ctx.revert() or kill the running timeline.
  useLayoutEffect(() => {
    if (!shouldRender || !overlayRef.current) return;

    // Resolve variant once for this run — never re-resolve on prop changes.
    const currentVariant =
      variantRef.current !== "auto"
        ? variantRef.current
        : (() => {
            try {
              return window.sessionStorage.getItem(SESSION_KEY)
                ? "compact"
                : "full";
            } catch {
              return "full";
            }
          })();
    const currentTimeScale = timeScaleRef.current;

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
          ".bl-bunting",
        ], { opacity: 1, scaleX: 1, y: 0, x: 0, skewX: 0, rotation: 0, scale: 1, transformOrigin: "center center" });
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: LOADER_TIMING.reducedMotionFade,
            onComplete: () => {
              buildCompletedRef.current = true;
              if (!isLoadingRef.current) {
                runExit(adaptiveExitSecRef.current);
              }
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

      const buntingCfg = LOADER_TIMING.bunting;
      gsap.set(".bl-bunting", { y: -buntingCfg.dropDistance, opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () => {
          buildCompletedRef.current = true;
          if (!isLoadingRef.current) {
            runExit(adaptiveExitSecRef.current);
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
        // T drops right after R lands
        .to(".bl-letter-t", {
          y: 0,
          opacity: 1,
          duration: cfg.letterDropDuration,
          ease: "bounce.out",
        }, "-=0.22")
        .to(".bl-awning-group", {
          scaleY: 0.94,
          duration: 0.07,
          yoyo: true,
          repeat: 1,
          ease: "power1.inOut",
        }, "-=0.15")
        // U drops right after T lands
        .to(".bl-letter-u", {
          y: 0,
          opacity: 1,
          duration: cfg.letterDropDuration,
          ease: "bounce.out",
        }, "-=0.22")
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

      // STEP 5: Fiesta banderitas wrappers drop in staggered (absolute start times).
      // Even though they're added late in the chain, absolute times keep them overlapping
      // the logo build so the total build duration does not grow.
      tl.to(
        ".bl-bunting--top",
        { y: 0, opacity: 1, duration: buntingCfg.dropDuration, ease: "back.out(1.4)" },
        buntingCfg.topStart
      )
        .to(
          ".bl-bunting--low",
          { y: 0, opacity: 1, duration: buntingCfg.dropDuration, ease: "back.out(1.4)" },
          buntingCfg.lowStart
        )
        .to(
          ".bl-bunting--bottom",
          {
            y: 0,
            opacity: 1,
            duration: buntingCfg.dropDuration,
            ease: "back.out(1.4)",
          },
          buntingCfg.bottomStart
        );

      // Network-aware starting speed: slow networks play slower, fast networks play at normal/compact speed
      const effType = (navigator as any).connection?.effectiveType;
      const isSlowNetwork =
        effType === "slow-2g" || effType === "2g" || effType === "3g";
      let startTimeScale: number;
      if (isSlowNetwork) {
        startTimeScale = 0.75;
      } else if (currentVariant === "compact") {
        startTimeScale = LOADER_TIMING.compact.timeScale;
      } else if (currentTimeScale && currentTimeScale !== 1) {
        startTimeScale = currentTimeScale;
      } else {
        startTimeScale = 1.0;
      }
      tl.timeScale(startTimeScale);

      buildTlRef.current = tl;
    }, overlayRef);

    return () => {
      buildTlRef.current = null;
      idleTlRef.current = null;
      ctx.revert();
    };
  }, [shouldRender]);

  // Accelerate the build timeline to finish in targetSec seconds,
  // computed from remaining time and actual load elapsed time.
  const accelerateToFinish = (tl: gsap.core.Timeline) => {
    const remaining = Math.max(0.05, tl.duration() - tl.time());
    const elapsed = Date.now() - loadStartMsRef.current;
    // Fast load finishes remaining steps briskly (~0.42s); slower load eases out (~0.58s)
    const targetSec = elapsed < 400 ? 0.42 : elapsed < 1200 ? 0.50 : 0.58;
    const neededScale = Math.max(1.5, Math.min(6.0, remaining / targetSec));
    adaptiveExitSecRef.current = elapsed < 400 ? 0.24 : elapsed < 1200 ? 0.32 : 0.40;
    gsap.killTweensOf(tl);
    gsap.to(tl, {
      timeScale: neededScale,
      duration: 0.12,
      ease: "power2.out",
      overwrite: true,
    });
  };

  // 6. Bidirectional adaptive speed:
  //    - While loading drags on, smoothly decelerate the build (calm, never frozen)
  //    - When loading finishes, fast-forward proportionally to how fast it actually was
  //    - Safety: if the build timeline is null (e.g. context was recreated), force
  //      the exit so the overlay never traps the app under a blank navy screen.
  useEffect(() => {
    if (!shouldRender) return;

    // ----- Still loading: schedule real-time slowdown -----
    if (isLoading) {
      if (loadStartMsRef.current === 0) {
        loadStartMsRef.current = Date.now();
      }

      const timer1 = window.setTimeout(() => {
        if (
          isLoadingRef.current &&
          buildTlRef.current &&
          !buildCompletedRef.current
        ) {
          gsap.to(buildTlRef.current, {
            timeScale: 0.55,
            duration: 0.5,
            ease: "power2.out",
            overwrite: true,
          });
        }
      }, 500);

      const timer2 = window.setTimeout(() => {
        if (
          isLoadingRef.current &&
          buildTlRef.current &&
          !buildCompletedRef.current
        ) {
          gsap.to(buildTlRef.current, {
            timeScale: 0.35,
            duration: 0.6,
            ease: "power2.out",
            overwrite: true,
          });
        }
      }, 1400);

      return () => {
        window.clearTimeout(timer1);
        window.clearTimeout(timer2);
      };
    }

    // ----- Loading finished: fast-forward adaptively -----
    if (!isLoading) {
      const elapsedMs = Date.now() - loadStartMsRef.current;
      adaptiveExitSecRef.current =
        elapsedMs < 400 ? 0.24 : elapsedMs < 1200 ? 0.32 : 0.40;

      if (buildCompletedRef.current) {
        runExit(adaptiveExitSecRef.current);
      } else if (buildTlRef.current) {
        accelerateToFinish(buildTlRef.current);
      } else {
        // No timeline exists — force the exit immediately so we never
        // leave the user staring at a blank navy overlay.
        runExit(adaptiveExitSecRef.current);
      }
    }
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

      <div ref={stageRef} className="brand-loader-stage" style={{ position: "relative", zIndex: 2 }}>
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

      <div className="bl-bunting bl-bunting--top" aria-hidden="true">
        <div className="bl-bunting-scale">
          <Banderitas variant="canopy" opacity={0.95} />
        </div>
      </div>
      <div className="bl-bunting bl-bunting--low" aria-hidden="true">
        <div className="bl-bunting-scale">
          <Banderitas variant="garland" opacity={0.9} />
        </div>
      </div>
      <div className="bl-bunting bl-bunting--bottom" aria-hidden="true">
        <div className="bl-bunting-scale">
          <Banderitas variant="garland" opacity={0.8} />
        </div>
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
