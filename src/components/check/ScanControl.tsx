"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

// The camera half of the aisle check. `check.lead` has always read "Scan or
// type what is in your hand", so this control is not an addition to the
// screen; it is the half of the promise that was written and never wired.
//
// Native BarcodeDetector, no bundled decoder. Three reasons, in order of
// weight:
//   1. F58 asks for a scan on a device that has a camera and typed entry on
//      one that does not. Feature detection plus a real degraded state
//      satisfies that without shipping a decoder to every visitor.
//   2. R20 wants a first load to reach no host outside the two the product
//      operates. Every added library is another chance for a CDN reference
//      to creep in, which is the same reason both typefaces are self-hosted.
//   3. BarcodeDetector is explicitly not Baseline: MDN marks it "Limited
//      availability" because it does not work in some of the most widely
//      used browsers, and does not enumerate which. So this feature-detects
//      and never sniffs a user agent, and the absent path is a first-class
//      state rather than a broken button.
//
// Secure context. getUserMedia and BarcodeDetector both require one. The
// deployment is HTTPS and localhost counts as secure, so there is no third
// branch for it: on an insecure origin the detection below simply fails and
// the unsupported sentence renders, which is the correct thing to say.

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

// The symbologies a collectable actually carries: retail barcodes on the
// box (EAN/UPC), catalogue and inventory codes printed as Code 128 or Code
// 39, ITF on outer cartons, and QR on newer promotional inserts. Requested
// as a preference, never as a requirement: the list is intersected with
// what the device reports so a browser supporting only a subset still
// scans, and an empty intersection reads as unsupported rather than as an
// error the user could act on.
const WANTED_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "qr_code",
];

// 200ms between detect() calls. Fast enough that a barcode held steady
// resolves in well under a second, slow enough that the main thread is not
// saturated decoding frames a phone camera has not finished focusing.
const DETECT_INTERVAL_MS = 200;

function barcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

function cameraAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

export function scanSupported(): boolean {
  return barcodeDetectorCtor() !== null && cameraAvailable();
}

type Phase = "closed" | "starting" | "live" | "error" | "detected";

export function ScanControl({
  onDecode,
  activeIdentifier,
}: {
  onDecode: (identifier: string) => void;
  /** The identifier the verdict currently on screen was computed from. The
   * "scanned with the camera" confirmation is only true while that verdict
   * is the one the camera produced, so it is derived from this rather than
   * left standing until the next scan: a collector who scans one box and
   * then types a different number must not be told the typed verdict came
   * off the camera. */
  activeIdentifier: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("closed");
  const [supported, setSupported] = useState(true);
  const [detectedValue, setDetectedValue] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // The decode callback is read inside a long-lived interval. A ref keeps
  // that interval from being torn down and rebuilt (which would restart the
  // camera) every time the parent re-renders with a new closure.
  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  });

  useEffect(() => {
    // Capability, not a user agent. This runs after mount rather than
    // during render because the server has no window to detect against, and
    // a lazy useState initialiser reading `window` would make the first
    // client render disagree with the server HTML and log a hydration
    // error. The button renders in the server output and is replaced by the
    // unsupported sentence a frame later, only on devices that cannot scan.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    if (!scanSupported()) setSupported(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPhase((prev) => (prev === "detected" || prev === "error" ? prev : "closed"));
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    // One stop path for every way the camera can end: the close button, an
    // unmount, a hidden tab, a successful decode, a failure mid-stream. A
    // camera left running is a battery drain and a privacy defect, and this
    // product tells collectors their data stays on the device.
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) close();
    };

    void (async () => {
      const Ctor = barcodeDetectorCtor();
      if (!Ctor || !cameraAvailable()) {
        if (!cancelled) {
          setSupported(false);
          setOpen(false);
          setPhase("closed");
        }
        return;
      }

      let detector: BarcodeDetectorLike;
      try {
        // getSupportedFormats is the only honest way to ask; an
        // implementation that rejects an unknown format at construction
        // would otherwise throw on a device that can scan perfectly well.
        const available = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : [];
        const formats = WANTED_FORMATS.filter((f) => available.includes(f));
        if (available.length > 0 && formats.length === 0) {
          if (!cancelled) {
            setSupported(false);
            setOpen(false);
            setPhase("closed");
          }
          return;
        }
        detector = formats.length > 0 ? new Ctor({ formats }) : new Ctor();
      } catch {
        if (!cancelled) {
          setPhase("error");
          setOpen(false);
        }
        return;
      }

      try {
        // `ideal`, never `exact`: a laptop has one camera and no
        // environment-facing mode, and an exact constraint would turn a
        // working scan into an OverconstrainedError on every desktop.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        // Permission refused, no camera attached, or the device is already
        // held by another application. All three land here and all three
        // leave typed entry working.
        if (!cancelled) {
          setPhase("error");
          setOpen(false);
        }
        return;
      }

      if (cancelled) {
        stop();
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        stop();
        if (!cancelled) {
          setPhase("error");
          setOpen(false);
        }
        return;
      }
      if (cancelled) {
        stop();
        return;
      }
      setPhase("live");

      timer = setInterval(() => {
        if (inFlight || cancelled) return;
        const el = videoRef.current;
        if (!el || el.readyState < 2 || el.videoWidth === 0) return;
        inFlight = true;
        detector
          .detect(el)
          .then((codes) => {
            if (cancelled) return;
            const value = codes.map((c) => c.rawValue?.trim()).find((v) => v && v.length > 0);
            if (!value) return;
            stop();
            setDetectedValue(value);
            setPhase("detected");
            setOpen(false);
            onDecodeRef.current(value);
          })
          .catch(() => {
            // A single failed frame is normal (the camera is refocusing,
            // the surface is not readable yet). Only a stream that dies
            // outright is an error, and that surfaces through the video
            // element, not through one rejected detect.
          })
          .finally(() => {
            inFlight = false;
          });
      }, DETECT_INTERVAL_MS);
    })();

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [open, close]);

  function onToggle() {
    if (open) {
      close();
      return;
    }
    if (!scanSupported()) {
      setSupported(false);
      setPhase("closed");
      return;
    }
    setDetectedValue(null);
    setPhase("starting");
    setOpen(true);
  }

  const note = !supported
    ? { text: t("check.scan.unsupported"), unsettled: true }
    : phase === "error"
      ? { text: t("check.scan.error"), unsettled: true }
      : phase === "starting"
        ? { text: t("check.scan.starting"), unsettled: false }
        : phase === "live"
          ? { text: t("check.scan.hint"), unsettled: false }
          : phase === "detected" && detectedValue !== null && detectedValue === activeIdentifier
            ? { text: t("check.scan.detected", { identifier: detectedValue }), unsettled: false }
            : null;

  return (
    <div className="stack" style={{ gap: 12 }} data-testid="scan-control">
      {supported ? (
        <div className="fw block">
          <button
            type="button"
            className="btn sec b56 full"
            onClick={onToggle}
            aria-expanded={open}
            data-testid="scan-toggle"
            data-scan-phase={phase}
          >
            {open ? t("check.scan.close") : t("check.scan.open")}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="scanView cut18" data-testid="scan-view">
          {/* Muted and inline: a scan preview that demanded fullscreen on
              iOS, or that could carry audio, would be a surprise the
              collector never asked for. */}
          <video
            ref={videoRef}
            aria-label={t("check.scan.viewLabel")}
            muted
            playsInline
            disablePictureInPicture
          />
          {/* The reticle carries the 45 degree cut, not a rounded frame
              (C9), and is drawn in --edge so no accent colour leaks onto a
              surface that is neither settled nor unsettled (C30). */}
          <svg
            className="scanRet"
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            <g fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M40 90 V40 H90" />
              <path d="M310 40 L360 90" />
              <path d="M40 210 V260 H90" />
              <path d="M360 210 V260 H310" />
            </g>
          </svg>
        </div>
      ) : null}

      <div role="status" aria-live="polite">
        {note ? (
          <p className={note.unsettled ? "scanNote bad" : "scanNote"} data-testid="scan-note">
            {note.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
