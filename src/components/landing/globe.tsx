"use client";

import createGlobe, { type Arc, type Marker } from "cobe";
import { useEffect, useRef, type CSSProperties } from "react";

type Finding = {
  id: string;
  location: [number, number];
  value: string;
  detail: string;
};

const FINDINGS: Finding[] = [
  { id: "user", location: [37.7749, -122.4194], value: "nightowl_92", detail: "Same username on 17 sites" },
  { id: "email", location: [40.7128, -74.006], value: "m.k•••••@gmail.com", detail: "Found in 4 breaches" },
  { id: "phone", location: [-23.5505, -46.6333], value: "+55 11 9••••-••34", detail: "Listed on 2 public pages" },
  { id: "name", location: [51.5072, -0.1276], value: "Marta K.", detail: "Linked to nightowl_92" },
];

const NOISE: [number, number][] = [
  [35.6762, 139.6503], [52.52, 13.405], [-34.6037, -58.3816], [19.076, 72.8777],
  [55.7558, 37.6173], [-33.8688, 151.2093], [1.3521, 103.8198], [41.9028, 12.4964],
  [59.3293, 18.0686], [43.6532, -79.3832], [25.2048, 55.2708], [-26.2041, 28.0473],
  [19.4326, -99.1332], [50.0755, 14.4378], [52.2297, 21.0122], [40.4168, -3.7038],
];

const MARKERS: Marker[] = [
  ...FINDINGS.map((f) => ({ id: f.id, location: f.location, size: 0.026 })),
  ...NOISE.map((location) => ({ location, size: 0.012, color: [0.55, 0.55, 0.55] as [number, number, number] })),
];

const ARCS: Arc[] = [
  { from: FINDINGS[0].location, to: FINDINGS[1].location },
  { from: FINDINGS[1].location, to: FINDINGS[3].location },
  { from: FINDINGS[0].location, to: FINDINGS[2].location },
];

const START_PHI = -0.35;
const THETA = 0.28;

export default function Globe() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = window.innerWidth < 768;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    let size = host.offsetWidth;
    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: START_PHI,
      theta: THETA,
      dark: 1,
      diffuse: 1.1,
      mapSamples: small ? 9000 : 16000,
      mapBrightness: 5.5,
      mapBaseBrightness: 0.02,
      baseColor: [0.22, 0.22, 0.22],
      markerColor: [1, 1, 1],
      glowColor: [0.16, 0.16, 0.16],
      markers: MARKERS,
      arcs: ARCS,
      arcColor: [0.75, 0.75, 0.75],
      arcWidth: 0.6,
      arcHeight: 0.25,
      markerElevation: 0.01,
    });

    let phi = START_PHI;
    let dragOffset = 0;
    let dragVelocity = 0;
    let pointerX: number | null = null;
    let lastX = 0;
    let visible = true;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      if (pointerX === null) {
        if (!reducedMotion) phi += 0.0022 * dt;
        dragOffset += dragVelocity * dt;
        dragVelocity *= Math.pow(0.92, dt);
      }
      globe.update({ phi: phi + dragOffset, width: size * dpr, height: size * dpr });
      const idle = reducedMotion && pointerX === null && Math.abs(dragVelocity) < 1e-4;
      frame = visible && !document.hidden && !idle ? requestAnimationFrame(tick) : 0;
    };

    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onDown = (e: PointerEvent) => {
      pointerX = e.clientX;
      lastX = e.clientX;
      dragVelocity = 0;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
      start();
    };
    const onMove = (e: PointerEvent) => {
      if (pointerX === null) return;
      const delta = (e.clientX - lastX) / 220;
      dragOffset += delta;
      dragVelocity = delta;
      lastX = e.clientX;
    };
    const onUp = () => {
      pointerX = null;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const resize = new ResizeObserver(() => {
      size = host.offsetWidth;
      if (!frame) globe.update({ width: size * dpr, height: size * dpr });
    });
    resize.observe(host);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(host);

    const onVisibility = () => (document.hidden ? stop() : visible && start());
    document.addEventListener("visibilitychange", onVisibility);

    start();
    const repaint = window.setTimeout(() => globe.update({}), 400);
    const ready = window.setTimeout(() => host.parentElement?.style.setProperty("--ready", "1"), reducedMotion ? 0 : 1100);

    return () => {
      stop();
      window.clearTimeout(ready);
      window.clearTimeout(repaint);
      io.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      globe.destroy();
      host.replaceChildren();
    };
  }, []);

  return (
    <div className="relative aspect-square w-full">
      <div ref={hostRef} className="absolute inset-0" />
      {FINDINGS.map((f) => (
        <div
          key={f.id}
          className="globe-chip"
          style={{ positionAnchor: `--cobe-${f.id}`, "--v": `var(--cobe-visible-${f.id}, 0)` } as CSSProperties}
        >
          <div className="rounded-md border border-white/15 bg-black/70 px-3 py-2 backdrop-blur-md">
            <p className="font-mono text-[12px] leading-tight text-white">{f.value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-white/55">{f.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
