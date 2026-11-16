"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Adiciona .is-visible uma única vez quando o elemento entra na viewport. */
function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/** Wrapper que ativa animações CSS descendentes ao entrar na viewport. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`${className}${visible ? " is-visible" : ""}`}>
      {children}
    </div>
  );
}

const INK = "#2B2C2E";
const BEIGE = "#D9CCB5";
const TERRA = "#B5583C";
const TERRA_LIGHT = "#C2694A";
const DEEP = "#614943";

function approxWidth(text: string, fontSize = 13) {
  return Math.round(text.length * fontSize * 0.58) + 28;
}

type FlowDiagramProps = {
  top: string[];
  bottom: string[];
  core: string;
  dark?: boolean;
};

/**
 * Diagrama de fluxo no estilo do site institucional RSBUILD:
 * conectores que se desenham (stroke-dashoffset) + nós que surgem com glow.
 */
export function FlowDiagram({ top, bottom, core, dark = false }: FlowDiagramProps) {
  const { ref, visible } = useInView<SVGSVGElement>(0.3);

  const W = 800, H = 400;
  const coreY = 188, coreH = 56;
  const topCy = 62, botCy = 344;
  const chipH = 40;

  const spread = (n: number) => {
    const margin = 110;
    if (n === 1) return [W / 2];
    return Array.from({ length: n }, (_, i) => margin + (i * (W - margin * 2)) / (n - 1));
  };
  const topXs = spread(top.length);
  const botXs = spread(bottom.length);
  const coreCx = W / 2;

  const connectors: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  topXs.forEach((x) => connectors.push({ x1: x, y1: topCy + chipH / 2, x2: coreCx, y2: coreY }));
  botXs.forEach((x) => connectors.push({ x1: coreCx, y1: coreY + coreH, x2: x, y2: botCy - chipH / 2 }));

  const chip = (cx: number, cy: number, label: string, fill: string, textFill: string, stroke: string, delay: number) => {
    const w = approxWidth(label);
    return (
      <g key={label + cx} className="inst-node">
        <rect
          className="inst-node-pop"
          x={cx - w / 2} y={cy - chipH / 2} width={w} height={chipH} rx={10}
          fill={fill} stroke={stroke} strokeWidth="1.4"
          style={{ animationDelay: `${delay}s` }}
        />
        <circle className="inst-node-glow" cx={cx} cy={cy} r={chipH / 2 + 6} fill="none" stroke={TERRA_LIGHT} strokeWidth="1.5"
          style={{ animationDelay: `${delay}s` }} />
        <text className="inst-node-label" x={cx} y={cy + 4.5} textAnchor="middle"
          fontSize="13" fontWeight="600" fill={textFill}
          fontFamily="Libre Franklin, Arial, sans-serif"
          style={{ animationDelay: `${delay + 0.15}s` }}>{label}</text>
      </g>
    );
  };

  const labelColor = dark ? BEIGE : INK;
  const chipFill = dark ? "rgba(255,255,255,0.07)" : "#FFFFFF";
  const chipStroke = dark ? "rgba(217,204,181,0.35)" : "rgba(97,73,67,0.3)";

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`inst-svg${visible ? " is-visible" : ""}`}
      role="img"
      aria-label={`Diagrama: ${top.join(", ")} alimentam ${core}, que governa ${bottom.join(", ")}`}
    >
      {/* Conectores — desenham-se em sequência */}
      {connectors.map((c, i) => (
        <line
          key={i}
          className="inst-conn"
          x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
          stroke={TERRA_LIGHT} strokeWidth="1.6"
          pathLength={100}
          style={{ animationDelay: `${0.2 + i * 0.15}s` }}
        />
      ))}

      {/* Nós superiores */}
      {top.map((label, i) => chip(topXs[i], topCy, label, chipFill, labelColor, chipStroke, 1.1 + i * 0.12))}

      {/* Núcleo */}
      <g className="inst-node">
        <rect
          className="inst-node-pop"
          x={coreCx - 105} y={coreY - coreH / 2} width={210} height={coreH} rx={12}
          fill={TERRA} stroke={TERRA} strokeWidth="1.4"
          style={{ animationDelay: "1.5s" }}
        />
        <circle className="inst-node-glow" cx={coreCx} cy={coreY + coreH / 2} r={coreH / 2 + 8} fill="none" stroke={TERRA_LIGHT} strokeWidth="1.5"
          style={{ animationDelay: "1.5s" }} />
        <text className="inst-node-label" x={coreCx} y={coreY + 5} textAnchor="middle"
          fontSize="16" fontWeight="800" fill="#FFFFFF" letterSpacing="1"
          fontFamily="Libre Franklin, Arial, sans-serif"
          style={{ animationDelay: "1.65s" }}>{core}</text>
      </g>

      {/* Nós inferiores */}
      {bottom.map((label, i) => chip(botXs[i], botCy, label, chipFill, labelColor, chipStroke, 1.8 + i * 0.12))}
    </svg>
  );
}

/**
 * Hero: Prisma Isométrico de Governança RSBUILD.
 * Diagramação executiva de alta resolução — v3 (fix distorção):
 * viewBox 820×460 preservado → vértices do prisma ORIGINAIS sem distorção.
 * Ganho visual: CSS grid 0.82fr/1.18fr + min-height 360px (globals.css).
 * Cards 295×82px, tipografia 15px/12.5px, ícone r=24, monograma scale=0.30.
 */
export function HeroNetwork() {
  const { ref, visible } = useInView<SVGSVGElement>(0.1);
  const [isCoreHovered, setIsCoreHovered] = useState(false);
  const [hoveredSat, setHoveredSat] = useState<number | null>(null);

  /* ── Prisma: vértices ORIGINAIS (410,230) — sem distorção ───────── */
  /* Face Superior:  410,135 → 485,180 → 410,230 → 335,180            */
  /* Face Esquerda:  335,180 → 410,230 → 410,325 → 335,280            */
  /* Face Direita:   410,230 → 485,180 → 485,280 → 410,325            */

  const SATELLITES = [
    {
      id: "financas",
      title: "FINANÇAS & CAIXA",
      sub: "Fluxo de caixa, extratos & liquidez",
      x: 12,
      y: 38,
      width: 295,
      height: 82,
      iconColor: "#10B981",
      statusColor: "#10B981",
      delay: "0.8s",
      anchorX: 307,
      anchorY: 79,
      cubeX: 335,
      cubeY: 180,
      path: "M 307 79 L 335 180 L 410 230",
      revPath: "M 410 230 L 335 180 L 307 79",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "54px 79px" }}>
          <rect x="43" y="68" width="22" height="20" rx="3" fill="none" stroke="#10B981" strokeWidth="1.9" />
          <circle cx="54" cy="78" r="4" fill="none" stroke="#10B981" strokeWidth="1.9" />
          <path d="M46 78h1.8M60.2 78H62" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    },
    {
      id: "reconciliacao",
      title: "RECONCILIAÇÃO ERP",
      sub: "ERP & conciliação de baixas",
      x: 513,
      y: 38,
      width: 295,
      height: 82,
      iconColor: "#34D399",
      statusColor: "#10B981",
      delay: "0.95s",
      anchorX: 513,
      anchorY: 79,
      cubeX: 485,
      cubeY: 180,
      path: "M 513 79 L 485 180 L 410 230",
      revPath: "M 410 230 L 485 180 L 513 79",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "551px 79px" }}>
          <path d="M561 73A7.5 7.5 0 0 0 547.5 70.2L545 72.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="545 67.5 545 72.5 550 72.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M545 85A7.5 7.5 0 0 0 558.5 87.8L561 85.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="561 90.5 561 85.5 556 85.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    },
    {
      id: "expedicao",
      title: "EXPEDIÇÃO & PROVAS",
      sub: "Canhotos, NF-e & tracking",
      x: 12,
      y: 340,
      width: 295,
      height: 82,
      iconColor: "#F59E0B",
      statusColor: "#F59E0B",
      delay: "1.1s",
      anchorX: 307,
      anchorY: 381,
      cubeX: 335,
      cubeY: 280,
      path: "M 307 381 L 335 280 L 410 230",
      revPath: "M 410 230 L 335 280 L 307 381",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "54px 381px" }}>
          <rect x="43" y="371" width="13" height="12" rx="1.5" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
          <path d="M56 374.5h5.5l3.5 3.5v5H56v-8.5z" fill="none" stroke="#F59E0B" strokeWidth="1.9" strokeLinejoin="round" />
          <circle cx="47.5" cy="386" r="2.8" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
          <circle cx="61.5" cy="386" r="2.8" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
        </g>
      )
    },
    {
      id: "auditoria",
      title: "AUDITORIA & ALÇADAS",
      sub: "Alçadas, compliance & governança",
      x: 513,
      y: 340,
      width: 295,
      height: 82,
      iconColor: "#C2694A",
      statusColor: "#F59E0B",
      delay: "1.25s",
      anchorX: 513,
      anchorY: 381,
      cubeX: 485,
      cubeY: 280,
      path: "M 513 381 L 485 280 L 410 230",
      revPath: "M 410 230 L 485 280 L 513 381",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "551px 381px" }}>
          <path d="M551 370l8 3v6c0 5.5-4.5 9.2-8 10.5-3.5-1.3-8-5-8-10.5v-6l8-3z" fill="none" stroke="#C2694A" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M547.5 379l2.5 2.5 5.5-5.5" fill="none" stroke="#C2694A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }
  ];

  return (
    <svg
      ref={ref}
      viewBox="0 0 820 460"
      className={`inst-svg inst-hero-prism${visible ? " is-visible" : ""}${isCoreHovered ? " is-core-active" : ""}`}
      role="img"
      aria-label="Prisma Isométrico de Governança RSBUILD OS e seus 4 domínios operacionais"
    >
      <defs>
        <linearGradient id="faceTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C2694A" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#B5583C" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="faceLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#614943" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#2B2C2E" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="faceRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B5583C" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#2B2C2E" stopOpacity="0.65" />
        </linearGradient>
        <filter id="coreGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Anéis Orbitais — centro original (410,230) */}
      <g className="inst-orbital-rings" style={{ transformOrigin: "410px 230px" }}>
        <ellipse cx="410" cy="230" rx="235" ry="85" fill="none"
          stroke="rgba(217, 204, 181, 0.16)" strokeWidth="1.2" strokeDasharray="4 6"
          transform="rotate(-16 410 230)" />
        <ellipse cx="410" cy="230" rx="220" ry="78" fill="none"
          stroke="rgba(194, 105, 74, 0.22)" strokeWidth="1.2" strokeDasharray="6 8"
          transform="rotate(20 410 230)" />
      </g>

      {/* Linhas de Conexão */}
      {SATELLITES.map((sat, i) => {
        const isHovered = hoveredSat === i;
        return (
          <line
            key={`conn-${sat.id}`}
            className="inst-conn"
            x1={sat.anchorX} y1={sat.anchorY}
            x2={sat.cubeX} y2={sat.cubeY}
            stroke={isHovered || isCoreHovered ? "#C2694A" : TERRA_LIGHT}
            strokeWidth={isHovered || isCoreHovered ? "2.2" : "1.6"}
            strokeDasharray={isHovered || isCoreHovered ? "none" : "4 4"}
            opacity={isHovered || isCoreHovered ? 1 : 0.65}
            pathLength={100}
            style={{ animationDelay: `${0.2 + i * 0.15}s`, transition: "all 0.3s ease" }}
          />
        );
      })}

      {/* Pulsos de Dados — viagem contínua ao centro */}
      {SATELLITES.map((sat, i) => (
        <circle key={`pulse-in-${sat.id}`} r="3.5" fill="#F5F1EA" opacity="0.9">
          <animateMotion path={sat.path} dur={`${3.2 + i * 0.3}s`}
            repeatCount="indefinite" begin={`${0.5 + i * 0.4}s`} />
        </circle>
      ))}

      {/* Feixes reversos no hover do core */}
      {isCoreHovered && SATELLITES.map((sat, i) => (
        <circle key={`pulse-out-${sat.id}`} r="4" fill="#C2694A" opacity="0.95">
          <animateMotion path={sat.revPath} dur="1.6s"
            repeatCount="indefinite" begin={`${i * 0.2}s`} />
        </circle>
      ))}

      {/* PRISMA — vértices ORIGINAIS: apex(410,135), mid±75px, center(410,230), base(410,325) */}
      <g
        className="inst-prism-body inst-core-trigger"
        style={{ transformOrigin: "410px 230px" }}
        onMouseEnter={() => setIsCoreHovered(true)}
        onMouseLeave={() => setIsCoreHovered(false)}
        tabIndex={0}
        role="button"
        aria-label="Núcleo de Governança RSBUILD OS — Passe o mouse para sincronizar os 4 domínios"
      >
        {/* Face Superior */}
        <polygon points="410,135 485,180 410,230 335,180"
          fill="url(#faceTop)" stroke="#C2694A" strokeWidth="1.6"
          strokeLinejoin="round" className="inst-node-pop"
          style={{ animationDelay: "0.4s" }} />
        {/* Face Esquerda */}
        <polygon points="335,180 410,230 410,325 335,280"
          fill="url(#faceLeft)" stroke="#B5583C" strokeWidth="1.6"
          strokeLinejoin="round" className="inst-node-pop"
          style={{ animationDelay: "0.55s" }} />
        {/* Face Direita */}
        <polygon points="410,230 485,180 485,280 410,325"
          fill="url(#faceRight)" stroke="#C2694A" strokeWidth="1.6"
          strokeLinejoin="round" className="inst-node-pop"
          style={{ animationDelay: "0.7s" }} />

        {/* Eixo Central */}
        <line x1="410" y1="135" x2="410" y2="325"
          stroke="rgba(217, 204, 181, 0.45)" strokeWidth="1.2" strokeDasharray="2 3" />

        {/* Halo hover */}
        {isCoreHovered && (
          <circle cx="410" cy="230" r="52" fill="none"
            stroke="#C2694A" strokeWidth="1.8" strokeDasharray="4 4"
            className="inst-sat-icon-halo" />
        )}

        {/* Núcleo — r=46, monograma scale=0.30 para melhor resolução */}
        <g filter="url(#coreGlow)">
          <circle cx="410" cy="230" r="46"
            fill="#1E2024"
            stroke={isCoreHovered ? "#FFFFFF" : "#C2694A"}
            strokeWidth={isCoreHovered ? "2.5" : "2.1"}
            className="inst-node-glow" />
          <g transform="translate(410, 230) scale(0.30) translate(-276, -623)">
            <path d="m251.99 528.35-0.43359 0.23828v63.031c0 4.5898 2.5312 8.8516 6.6992 11.266l55.5 32.133c3.9453 2.2812 6.3438 6.3164 6.3438 10.66v63.328l13.676-7.3516c3.3555-1.8008 5.4258-5.1523 5.4258-8.7773v-57.324c0-4.3281-2.3906-8.3516-6.3203-10.625l-55.844-32.328c-3.9688-2.3008-6.3828-6.3594-6.3828-10.734v-42.223c4.7188-2.6875 10.641-2.6914 15.367-0.007812l1.4609 0.832-0.1875 38.219c-0.015625 2.6172 1.4844 5.0352 3.9141 6.3281l14.453 7.6914c2.8711 1.5312 6.5156 0.59766 8.168-2.082l16.133-26.188c5.2422-8.5117 2.1328-19.402-6.9531-24.316l-19.078 30.973 0.4648-41.883c-15.98-9.2656-36.094-9.5938-52.406-0.85938" fill="#FFFFFF" />
            <path d="m276.34 653.23c3.9688 2.2969 6.3828 6.3594 6.3828 10.734v42.223c-4.7188 2.6875-10.641 2.6914-15.367 0.003906l-1.4609-0.82812 0.1875-38.223c0.015625-2.6172-1.4844-5.0352-3.9102-6.3281l-14.453-7.6914c-2.875-1.5273-6.5195-0.59766-8.1719 2.082l-16.129 26.188c-5.2461 8.5156-2.1328 19.402 6.9531 24.32l19.078-30.977-0.4688 41.887c15.984 9.2656 36.094 9.5938 52.406 0.85547l0.4375-0.23828v-63.031c0-4.5859-2.5352-8.8516-6.7031-11.262l-55.5-32.137c-3.9414-2.2812-6.3438-6.3164-6.3438-10.66v-63.328l-13.676 7.3516c-3.3555 1.8047-5.4219 5.1523-5.4219 8.7812v57.324c0 4.3281 2.3867 8.3477 6.3203 10.621z" fill="#C2694A" />
          </g>
        </g>
      </g>

      {/* 4 SATÉLITES — ícones orbitais com identificação contextual */}
      {SATELLITES.map((sat, i) => {
        const isHovered = hoveredSat === i;
        const iconCx = sat.x + 41;
        const iconCy = sat.y + 41;
        const tooltipX = sat.x < 100 ? 84 : 316;
        const tooltipY = sat.y + 12;
        return (
          <g
            key={sat.id}
            className={`inst-satellite-group${isHovered ? " is-hovered" : ""}`}
            style={{ transformOrigin: `${iconCx}px ${iconCy}px` }}
            onMouseEnter={() => setHoveredSat(i)}
            onMouseLeave={() => setHoveredSat(null)}
            onFocus={() => setHoveredSat(i)}
            onBlur={() => setHoveredSat(null)}
            onClick={() => setHoveredSat((current) => current === i ? null : i)}
            tabIndex={0}
            role="button"
            aria-label={`${sat.title}. ${sat.sub}. Toque ou pressione Enter para ver detalhes.`}
            aria-pressed={isHovered}
          >
            {/* Ponto orbital — mantém a animação original */}
            <circle cx={iconCx} cy={iconCy} r="24" fill="#222428"
              stroke="rgba(217, 204, 181, 0.22)" strokeWidth="1.2"
              className="inst-node-pop" style={{ animationDelay: sat.delay }} />

            {/* Halo animado */}
            <circle className="inst-sat-icon-halo"
              cx={iconCx} cy={iconCy} r="24" fill="none"
              stroke={sat.iconColor} strokeWidth="1.8"
              opacity={isCoreHovered || isHovered ? "0.95" : "0.35"} />

            {sat.icon}

            {/* Identificação contextual — aparece apenas no hover, foco ou toque */}
            <g className="inst-module-tooltip" aria-hidden={!isHovered}>
              <rect x={tooltipX} y={tooltipY} width="218" height="58" rx="9"
                fill="#18191C" stroke="#B5583C" strokeWidth="1.2" />
              <circle cx={tooltipX + 11} cy={tooltipY + 16} r="2.5" fill={sat.iconColor} />
              <text x={tooltipX + 21} y={tooltipY + 20}
                fontSize="11.5" fontWeight="800" fill="#F5F1EA"
                letterSpacing="0.035em" fontFamily="Libre Franklin, Arial, sans-serif">
                {sat.title}
              </text>
              <text x={tooltipX + 12} y={tooltipY + 41}
                fontSize="10.5" fontWeight="500" fill="rgba(217, 204, 181, 0.86)"
                fontFamily="Libre Franklin, Arial, sans-serif">
                {sat.sub}
              </text>
            </g>
          </g>
        );
      })}

      {/* Rótulo Institucional de Base */}
      <g className="inst-node" style={{ transformOrigin: "410px 440px" }}>
        <text x="410" y="444" textAnchor="middle"
          fill={isCoreHovered ? "#FFFFFF" : TERRA_LIGHT}
          fontSize="12" fontWeight="800" letterSpacing="2.5"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.6s", transition: "all 0.3s ease" }}>
          {isCoreHovered
            ? "✦ NÚCLEO ATIVO · 4 DOMÍNIOS OPERACIONAIS SINCRONIZADOS ✦"
            : "RSBUILD OS · NÚCLEO DE GOVERNANÇA INTEGRADA"}
        </text>
      </g>
    </svg>
  );
}

/** Governança: fluxo responsivo com rótulos multilinha e largura suficiente. */
export function GovernanceFlow({ items }: { items: string[] }) {
  const { ref, visible } = useInView<SVGSVGElement>(0.3);
  const W = 560;
  const rowHeight = 104;
  const H = 48 + items.length * rowHeight;
  const x = 34;
  const wrap = (value: string, maxChars = 58) => {
    const words = value.split(/\\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className={`inst-svg inst-governance-flow${visible ? " is-visible" : ""}`}
      role="img"
      aria-label="Ciclo de governança"
    >
      <line
        className="inst-conn"
        x1={x}
        y1={34}
        x2={x}
        y2={H - 34}
        stroke={TERRA_LIGHT}
        strokeWidth="2"
        pathLength={100}
        style={{ animationDelay: "0.2s" }}
      />
      {items.map((label, i) => {
        const cy = 48 + i * rowHeight;
        const lines = wrap(label);
        return (
          <g key={label}>
            <circle
              className="inst-node-glow"
              cx={x}
              cy={cy}
              r={13}
              fill="none"
              stroke={TERRA_LIGHT}
              strokeWidth="1.5"
              style={{ animationDelay: `${0.9 + i * 0.45}s` }}
            />
            <circle
              className="inst-node-pop"
              cx={x}
              cy={cy}
              r={6}
              fill={TERRA_LIGHT}
              style={{ animationDelay: `${0.9 + i * 0.45}s` }}
            />
            <text
              className="inst-node-label"
              x={x + 22}
              y={cy - ((lines.length - 1) * 9)}
              fontSize="13.5"
              fontWeight="600"
              fill={BEIGE}
              fontFamily="Libre Franklin, Arial, sans-serif"
              style={{ animationDelay: `${1.05 + i * 0.45}s` }}
            >
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={x + 22} dy={lineIndex === 0 ? 0 : 19}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}


/* --------------------------------------------------------------------------
   Diagramas institucionais — arquitetura (estrutura) e operação (movimento)
   -------------------------------------------------------------------------- */

const ARCH_SOURCES = [
  { icon: "▱", title: "ERP / Sistemas", detail: "Sistemas empresariais" },
  { icon: "⌂", title: "Bancos", detail: "Movimentações financeiras" },
  { icon: "▤", title: "Documentos (OCR)", detail: "Documentos e registros" },
  { icon: "◫", title: "Dados", detail: "APIs e planilhas" }
];

const ARCH_CAPABILITIES = [
  { icon: "▥", title: "Monitoramento operacional", detail: "Visibilidade dos processos" },
  { icon: "↯", title: "Automação com regras", detail: "Execução dentro do escopo" },
  { icon: "⌘", title: "Verificação e conciliação", detail: "Consistência e evidências" },
  { icon: "◎", title: "Suporte à decisão", detail: "Análises e recomendações" }
];

const ARCH_LAYERS = [
  { title: "Inteligência e agentes", detail: "Análise · automação · recomendações", tone: "intelligence" },
  { title: "Orquestração de processos", detail: "Regras · fluxos · tarefas · integrações", tone: "orchestration" },
  { title: "Dados e contexto", detail: "Consolidação · qualidade · rastreabilidade", tone: "data" },
  { title: "Governança e controle", detail: "Permissões · auditoria · supervisão", tone: "governance" }
];

const ARCH_OUTCOMES = [
  { icon: "◎", title: "Processos organizados" },
  { icon: "✓", title: "Validações confiáveis" },
  { icon: "◇", title: "Governança aplicada" },
  { icon: "▱", title: "Decisões acompanhadas" }
];

export function ArchitectureDiagram() {
  const { ref, visible } = useInView<HTMLDivElement>(0.12);
  return (
    <div ref={ref} className={`rs-architecture${visible ? " is-visible" : ""}`} role="group" aria-label="Arquitetura conceitual do RSBUILD OS">
      <div className="rs-architecture-grid">
        <div className="rs-architecture-column rs-architecture-sources">
          <div className="rs-architecture-heading">Fontes de informação</div>
          {ARCH_SOURCES.map((item, i) => (
            <div className="rs-architecture-node" key={item.title} style={{ "--node-delay": `${i * 100}ms` } as CSSProperties}>
              <span className="rs-architecture-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            </div>
          ))}
        </div>

        <div className="rs-architecture-core">
          <div className="rs-architecture-cap">
            <span className="rs-architecture-mark">S</span>
            <strong>RSBUILD OS</strong>
            <small>Camada de governança operacional</small>
          </div>
          <div className="rs-architecture-layers">
            {ARCH_LAYERS.map((layer, i) => (
              <div className={`rs-architecture-layer ${layer.tone}`} key={layer.title} style={{ "--layer-delay": `${i * 120}ms` } as CSSProperties}>
                <span className="rs-architecture-layer-index">0{i + 1}</span>
                <span><strong>{layer.title}</strong><small>{layer.detail}</small></span>
              </div>
            ))}
          </div>
          <div className="rs-architecture-base" />
        </div>

        <div className="rs-architecture-column rs-architecture-capabilities">
          <div className="rs-architecture-heading">Capacidades operacionais</div>
          {ARCH_CAPABILITIES.map((item, i) => (
            <div className="rs-architecture-node" key={item.title} style={{ "--node-delay": `${i * 100}ms` } as CSSProperties}>
              <span className="rs-architecture-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            </div>
          ))}
        </div>
      </div>
      <div className="rs-architecture-outcomes">
        <strong className="rs-architecture-outcomes-label">Resultado na operação</strong>
        {ARCH_OUTCOMES.map((item) => (
          <div className="rs-architecture-outcome" key={item.title}>
            <span aria-hidden="true">{item.icon}</span><strong>{item.title}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const OPERATION_STEPS = [
  { num: "01", title: "Captura", text: "Coleta e organiza as informações da operação", icon: "▤" },
  { num: "02", title: "Processa", text: "Aplica regras, valida e enriquece os dados", icon: "⚙" },
  { num: "03", title: "Orquestra", text: "Executa fluxos, tarefas e integrações", icon: "⌘" },
  { num: "04", title: "Monitora", text: "Acompanha resultados, eventos e desvios", icon: "▥" },
  { num: "05", title: "Apoia ações", text: "Gera alertas e suporte à decisão", icon: "✓" }
];

const OPERATION_SOURCES = ["ERP / Sistemas", "Documentos", "Dados", "Outras fontes"];
const OPERATION_AGENTS = [
  { icon: "⌕", title: "Análise operacional" },
  { icon: "✓", title: "Conciliação e verificações" },
  { icon: "♧", title: "Alertas e exceções" },
  { icon: "⌘", title: "Recomendações de ação" }
];

export function OperationalFlow() {
  const { ref, visible } = useInView<HTMLDivElement>(0.12);
  return (
    <div ref={ref} className={`rs-operational-flow${visible ? " is-visible" : ""}`} role="group" aria-label="Fluxo operacional do RSBUILD OS">
      <div className="rs-operational-cycle">
        <span className="rs-operational-cycle-icon" aria-hidden="true">↻</span>
        <span><strong>Ciclo de melhoria contínua</strong><small>Monitora · aprende · ajusta</small></span>
      </div>
      <div className="rs-operational-main">
        <div className="rs-operational-sources">
          <strong>Sua operação</strong>
          {OPERATION_SOURCES.map((source) => <span key={source}>{source}</span>)}
        </div>
        <div className="rs-operational-steps">
          {OPERATION_STEPS.map((step, i) => (
            <div className={`rs-operational-step step-${i + 1}`} key={step.num} style={{ "--step-delay": `${i * 130}ms` } as CSSProperties}>
              <span className="rs-operational-step-icon" aria-hidden="true">{step.icon}</span>
              <span className="rs-operational-step-number">{step.num}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rs-operational-agents">
        <strong className="rs-operational-agents-label">Recursos de apoio</strong>
        {OPERATION_AGENTS.map((agent) => (
          <div key={agent.title}><span aria-hidden="true">{agent.icon}</span><strong>{agent.title}</strong></div>
        ))}
      </div>
      <div className="rs-operational-footnote">A atuação depende das regras, integrações, permissões e do escopo definidos para cada aplicação.</div>
    </div>
  );
}
