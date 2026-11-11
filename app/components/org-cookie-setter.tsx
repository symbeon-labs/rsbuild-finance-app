"use client";

import { useEffect } from "react";

const COOKIE_NAME = "rsbuild_selected_org";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/**
 * Persiste a organização selecionada em cookie para que a próxima
 * visita redirecione automaticamente, sem exibir a tela de seleção.
 */
export function OrgCookieSetter({ organizationId }: { organizationId: string }) {
  useEffect(() => {
    document.cookie = `${COOKIE_NAME}=${organizationId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [organizationId]);

  return null;
}
