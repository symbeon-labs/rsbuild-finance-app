/**
 * brand-color.ts
 * Utilitários para derivar e aplicar tokens de cor de marca por workspace (Brand Color Picker).
 * Substitui dinamicamente o --rsbuild-terracotta e variantes derivadas no document root.
 */

/**
 * Deriva os tokens de cor de marca (main, hover, soft) a partir de um hex.
 * - hover: luminosidade reduzida em ~15% (multiplicação RGB × 0.85)
 * - soft: blend de 8% do main sobre branco (#FFFFFF) — fundo suave de destaque
 */
export function deriveBrandTokens(hex: string): { main: string; hover: string; soft: string } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // hover: 85% da luminosidade original (escurecimento suave)
  const hoverR = Math.max(0, Math.round(r * 0.85));
  const hoverG = Math.max(0, Math.round(g * 0.85));
  const hoverB = Math.max(0, Math.round(b * 0.85));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const hover = `#${toHex(hoverR)}${toHex(hoverG)}${toHex(hoverB)}`;

  // soft: blend 8% do main sobre branco — fundo de badge/highlight suave
  const softR = Math.round(255 * 0.92 + r * 0.08);
  const softG = Math.round(255 * 0.92 + g * 0.08);
  const softB = Math.round(255 * 0.92 + b * 0.08);
  const soft = `#${toHex(softR)}${toHex(softG)}${toHex(softB)}`;

  return { main: hex, hover, soft };
}

/**
 * Aplica os tokens de cor de marca ao CSS do document root via variáveis CSS.
 * Substitui --rsbuild-terracotta, --rsbuild-terracotta-hover, --rsbuild-terracotta-soft e --rsbuild-terracotta-light.
 */
export function applyBrandColor(hex: string): void {
  if (typeof document === "undefined") return;
  const { main, hover, soft } = deriveBrandTokens(hex);
  document.documentElement.style.setProperty("--rsbuild-terracotta", main);
  document.documentElement.style.setProperty("--rsbuild-terracotta-hover", hover);
  document.documentElement.style.setProperty("--rsbuild-terracotta-soft", soft);
  document.documentElement.style.setProperty("--rsbuild-terracotta-light", main);
}

