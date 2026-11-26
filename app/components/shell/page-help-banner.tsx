"use client";

import { useState, useEffect } from "react";

interface PageHelpBannerProps {
  /** Unique key used to persist the dismissed state in localStorage */
  storageKey: string;
  title: string;
  tips: string[];
}

/**
 * Dismissible contextual help banner.
 * Renders a terracota-accented tip block below the page heading.
 * Dismissed state is persisted to localStorage so it survives navigation.
 */
export function PageHelpBanner({ storageKey, title, tips }: PageHelpBannerProps) {
  const lsKey = `rsbuild_help_dismissed_${storageKey}`;
  const [visible, setVisible] = useState(false);

  // Read from localStorage on mount (SSR-safe)
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(lsKey);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [lsKey]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(lsKey, "1");
    } catch {
      // ignore storage errors
    }
  }

  if (!visible) return null;

  return (
    <div className="page-help-banner" role="note" aria-label="Dicas de uso desta página">
      <div className="page-help-banner-icon" aria-hidden="true">ⓘ</div>
      <div className="page-help-banner-body">
        <div className="page-help-banner-eyebrow">COMO USAR ESTE RECURSO</div>
        <div className="page-help-banner-title">{title}</div>
        <ul className="page-help-banner-tips">
          {tips.map((tip, i) => (
            <li key={i} className="page-help-banner-tip">
              <span className="page-help-banner-tip-num">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="page-help-banner-close"
        onClick={dismiss}
        aria-label="Ocultar dicas"
        title="Ocultar dicas"
      >
        ✕ Ocultar dicas
      </button>
    </div>
  );
}
