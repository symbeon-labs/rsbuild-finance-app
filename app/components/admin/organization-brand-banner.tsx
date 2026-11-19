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

  return (
    <section
      aria-label={"Identidade visual de " + organizationName}
      style={{
        width: "100%",
        aspectRatio: "3 / 1",
        maxHeight: 320,
        minHeight: 120,
        overflow: "hidden",
        borderRadius: 14,
        marginBottom: 22,
        background: "#100817",
        border: "1px solid rgba(124, 58, 237, .12)",
        boxShadow: "0 10px 28px rgba(20, 12, 30, .08)",
        position: "relative",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.bannerUrl}
        alt={"Identidade visual de " + organizationName}
        decoding="async"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: data.positionX + "% " + data.positionY + "%",
          transform: "scale(" + (data.zoom ?? 1) + ")",
        }}
      />
    </section>
  );
}
