"use client";

import { useEffect, useState } from "react";

export function OrganizationBrandBanner({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [data, setData] = useState<{ bannerUrl: string | null; positionX: number; positionY: number; zoom: number } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/organization-branding?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(value => { if (active && value) setData(value); })
      .catch(() => {});
    return () => { active = false; };
  }, [organizationId]);
  if (!data?.bannerUrl) return null;
  return <div aria-label={"Identidade visual de " + organizationName} style={{ height: "clamp(120px, 18vw, 210px)", overflow: "hidden", borderRadius: 12, marginBottom: 22, background: "#171717", position: "relative" }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={data.bannerUrl} alt={"Banner de " + organizationName} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: data.positionX + "% " + data.positionY + "%", transform: "scale(" + data.zoom + ")" }} />
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.48), transparent 75%)" }} />
    <strong style={{ position: "absolute", left: 22, bottom: 18, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,.55)", fontSize: 17 }}>{organizationName}</strong>
  </div>;
}
