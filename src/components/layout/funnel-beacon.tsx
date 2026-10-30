"use client";

import { useEffect } from "react";

export default function FunnelBeacon({ step }: { step: "landing" }) {
  useEffect(() => {
    const body = new Blob([JSON.stringify({ step })], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/funnel", body)) {
      fetch("/api/funnel", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [step]);
  return null;
}
