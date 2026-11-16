"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
 * Representação artística e executiva do ecossistema RSBUILD OS:
 * Cubo de governança 3D, monograma oficial no núcleo central,
 * e 4 cartões de domínios operacionais com ícones dedicados de alta definição,
 * tipografia executiva e animação sincronizada ao passar o mouse sobre o núcleo.
 */
export function HeroNetwork() {
  const { ref, visible } = useInView<SVGSVGElement>(0.1);
  const [isCoreHovered, setIsCoreHovered] = useState(false);
  const [hoveredSat, setHoveredSat] = useState<number | null>(null);

  const SATELLITES = [
    {
      id: "financas",
      title: "FINANÇAS & CAIXA",
      sub: "Fluxo, extratos & liquidez",
      x: 15,
      y: 44,
      iconColor: "#10B981",
      statusColor: "#10B981",
      delay: "0.8s",
      anchorX: 215,
      anchorY: 74,
      cubeX: 245,
      cubeY: 172,
      path: "M 215 74 L 245 172 L 320 220",
      revPath: "M 320 220 L 245 172 L 215 74",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "45px 74px" }}>
          <rect x="36" y="66" width="18" height="15" rx="2.5" fill="none" stroke="#10B981" strokeWidth="1.6" />
          <circle cx="45" cy="73.5" r="3.2" fill="none" stroke="#10B981" strokeWidth="1.6" />
          <path d="M39 73.5h1.5M49.5 73.5H51" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )
    },
    {
      id: "reconciliacao",
      title: "RECONCILIAÇÃO ERP",
      sub: "Omie & conciliação de baixas",
      x: 425,
      y: 44,
      iconColor: "#34D399",
      statusColor: "#10B981",
      delay: "0.95s",
      anchorX: 425,
      anchorY: 74,
      cubeX: 395,
      cubeY: 172,
      path: "M 425 74 L 395 172 L 320 220",
      revPath: "M 320 220 L 395 172 L 425 74",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "455px 74px" }}>
          <path d="M462 70A6.5 6.5 0 0 0 450.5 67.5L448 69.5" fill="none" stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="448 65 448 69.5 452.5 69.5" fill="none" stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M448 77A6.5 6.5 0 0 0 459.5 79.5L462 77.5" fill="none" stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="462 82 462 77.5 457.5 77.5" fill="none" stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    },
    {
      id: "expedicao",
      title: "EXPEDIÇÃO & PROVAS",
      sub: "Canhotos, NF-e & tracking",
      x: 15,
      y: 330,
      iconColor: "#F59E0B",
      statusColor: "#F59E0B",
      delay: "1.1s",
      anchorX: 215,
      anchorY: 360,
      cubeX: 245,
      cubeY: 268,
      path: "M 215 360 L 245 268 L 320 220",
      revPath: "M 320 220 L 245 268 L 215 360",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "45px 360px" }}>
          <rect x="36" y="352" width="11" height="9.5" rx="1.2" fill="none" stroke="#F59E0B" strokeWidth="1.6" />
          <path d="M47 355h4.5l3 3v3.5h-7.5V355z" fill="none" stroke="#F59E0B" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="40" cy="364" r="2.2" fill="none" stroke="#F59E0B" strokeWidth="1.6" />
          <circle cx="51.5" cy="364" r="2.2" fill="none" stroke="#F59E0B" strokeWidth="1.6" />
        </g>
      )
    },
    {
      id: "auditoria",
      title: "AUDITORIA & ALÇADAS",
      sub: "Regra Raquel & governança",
      x: 425,
      y: 330,
      iconColor: "#C2694A",
      statusColor: "#F59E0B",
      delay: "1.25s",
      anchorX: 425,
      anchorY: 360,
      cubeX: 395,
      cubeY: 268,
      path: "M 425 360 L 395 268 L 320 220",
      revPath: "M 320 220 L 395 268 L 425 360",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "455px 360px" }}>
          <path d="M455 351l6.5 2.5v5c0 4.5-3.5 7.5-6.5 8.5-3-1-6.5-4-6.5-8.5v-5l6.5-2.5z" fill="none" stroke="#C2694A" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M452 358.5l2 2 4.5-4.5" fill="none" stroke="#C2694A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }
  ];

  return (
    <svg
      ref={ref}
      viewBox="0 0 640 440"
      className={`inst-svg inst-hero-prism${visible ? " is-visible" : ""}${isCoreHovered ? " is-core-active" : ""}`}
      role="img"
      aria-label="Prisma Isométrico de Governança RSBUILD OS e seus 4 domínios operacionais"
    >
      <defs>
        {/* Gradientes das faces isométricas */}
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
        {/* Glow do Núcleo */}
        <filter id="coreGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="coreHaloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C2694A" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#B5583C" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2B2C2E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Anéis Orbitais Elípticos */}
      <g className="inst-orbital-rings" style={{ transformOrigin: "320px 220px" }}>
        <ellipse
          cx="320"
          cy="220"
          rx="195"
          ry="76"
          fill="none"
          stroke="rgba(217, 204, 181, 0.16)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          transform="rotate(-18 320 220)"
        />
        <ellipse
          cx="320"
          cy="220"
          rx="185"
          ry="68"
          fill="none"
          stroke="rgba(194, 105, 74, 0.22)"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          transform="rotate(22 320 220)"
        />
      </g>

      {/* Linhas de Conexão com os 4 Satélites */}
      {SATELLITES.map((sat, i) => {
        const isHovered = hoveredSat === i;
        return (
          <line
            key={`conn-${sat.id}`}
            className="inst-conn"
            x1={sat.anchorX}
            y1={sat.anchorY}
            x2={sat.cubeX}
            y2={sat.cubeY}
            stroke={isHovered || isCoreHovered ? "#C2694A" : TERRA_LIGHT}
            strokeWidth={isHovered || isCoreHovered ? "2.2" : "1.6"}
            strokeDasharray={isHovered || isCoreHovered ? "none" : "4 4"}
            opacity={isHovered || isCoreHovered ? 1 : 0.65}
            pathLength={100}
            style={{ animationDelay: `${0.2 + i * 0.15}s`, transition: "all 0.3s ease" }}
          />
        );
      })}

      {/* Pulsos de Dados Vivos: viagem contínua ao centro */}
      {SATELLITES.map((sat, i) => (
        <circle key={`pulse-in-${sat.id}`} r="3.5" fill="#F5F1EA" opacity="0.9">
          <animateMotion
            path={sat.path}
            dur={`${3.2 + i * 0.3}s`}
            repeatCount="indefinite"
            begin={`${0.5 + i * 0.4}s`}
          />
        </circle>
      ))}

      {/* Quando o Core está ativo: Feixes adicionais disparam do centro para os satélites! */}
      {isCoreHovered &&
        SATELLITES.map((sat, i) => (
          <circle key={`pulse-out-${sat.id}`} r="4" fill="#C2694A" opacity="0.95">
            <animateMotion
              path={sat.revPath}
              dur="1.6s"
              repeatCount="indefinite"
              begin={`${i * 0.2}s`}
            />
          </circle>
        ))}

      {/* O PRISMA ISOMÉTRICO RSBUILD (Cubo de Governança 3D Interativo) */}
      <g
        className="inst-prism-body inst-core-trigger"
        style={{ transformOrigin: "320px 220px" }}
        onMouseEnter={() => setIsCoreHovered(true)}
        onMouseLeave={() => setIsCoreHovered(false)}
        tabIndex={0}
        role="button"
        aria-label="Núcleo de Governança RSBUILD OS — Passe o mouse para ativar a sincronização dos satélites"
      >
        {/* Face Superior */}
        <polygon
          points="320,125 395,172 320,220 245,172"
          fill="url(#faceTop)"
          stroke="#C2694A"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Face Esquerda */}
        <polygon
          points="245,172 320,220 320,315 245,268"
          fill="url(#faceLeft)"
          stroke="#B5583C"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.55s" }}
        />
        {/* Face Direita */}
        <polygon
          points="320,220 395,172 395,268 320,315"
          fill="url(#faceRight)"
          stroke="#C2694A"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.7s" }}
        />

        {/* Eixo Central Vertical de Sustentação */}
        <line
          x1="320"
          y1="125"
          x2="320"
          y2="315"
          stroke="rgba(217, 204, 181, 0.45)"
          strokeWidth="1.2"
          strokeDasharray="2 3"
        />

        {/* Halo de irradiação concêntrica ativo no hover do núcleo */}
        {isCoreHovered && (
          <circle
            cx="320"
            cy="220"
            r="48"
            fill="none"
            stroke="#C2694A"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            className="inst-sat-icon-halo"
          />
        )}

        {/* NÚCLEO CENTRAL DE GOVERNANÇA: Monograma Oficial da RSBUILD */}
        <g filter="url(#coreGlow)">
          <circle
            cx="320"
            cy="220"
            r="40"
            fill="#1E2024"
            stroke={isCoreHovered ? "#FFFFFF" : "#C2694A"}
            strokeWidth={isCoreHovered ? "2.4" : "2"}
            className="inst-node-glow"
          />
          {/* Monograma Oficial da RSBUILD centrado e refinado */}
          <g transform="translate(320, 220) scale(0.245) translate(-276, -623)">
            <path
              d="m251.99 528.35-0.43359 0.23828v63.031c0 4.5898 2.5312 8.8516 6.6992 11.266l55.5 32.133c3.9453 2.2812 6.3438 6.3164 6.3438 10.66v63.328l13.676-7.3516c3.3555-1.8008 5.4258-5.1523 5.4258-8.7773v-57.324c0-4.3281-2.3906-8.3516-6.3203-10.625l-55.844-32.328c-3.9688-2.3008-6.3828-6.3594-6.3828-10.734v-42.223c4.7188-2.6875 10.641-2.6914 15.367-0.007812l1.4609 0.832-0.1875 38.219c-0.015625 2.6172 1.4844 5.0352 3.9141 6.3281l14.453 7.6914c2.8711 1.5312 6.5156 0.59766 8.168-2.082l16.133-26.188c5.2422-8.5117 2.1328-19.402-6.9531-24.316l-19.078 30.973 0.4648-41.883c-15.98-9.2656-36.094-9.5938-52.406-0.85938"
              fill="#FFFFFF"
            />
            <path
              d="m276.34 653.23c3.9688 2.2969 6.3828 6.3594 6.3828 10.734v42.223c-4.7188 2.6875-10.641 2.6914-15.367 0.003906l-1.4609-0.82812 0.1875-38.223c0.015625-2.6172-1.4844-5.0352-3.9102-6.3281l-14.453-7.6914c-2.875-1.5273-6.5195-0.59766-8.1719 2.082l-16.129 26.188c-5.2461 8.5156-2.1328 19.402 6.9531 24.32l19.078-30.977-0.4688 41.887c15.984 9.2656 36.094 9.5938 52.406 0.85547l0.4375-0.23828v-63.031c0-4.5859-2.5352-8.8516-6.7031-11.262l-55.5-32.137c-3.9414-2.2812-6.3438-6.3164-6.3438-10.66v-63.328l-13.676 7.3516c-3.3555 1.8047-5.4219 5.1523-5.4219 8.7812v57.324c0 4.3281 2.3867 8.3477 6.3203 10.621z"
              fill="#C2694A"
            />
          </g>
        </g>
      </g>

      {/* OS 4 SATÉLITES OPERACIONAIS (CARDS EXECUTIVOS ESPAÇOSOS E ÍCONES ANIMADOS) */}
      {SATELLITES.map((sat, i) => {
        const isHovered = hoveredSat === i;
        const iconCx = sat.x + 30;
        const iconCy = sat.y + 30;
        return (
          <g
            key={sat.id}
            className={`inst-satellite-group${isHovered ? " is-hovered" : ""}`}
            style={{ transformOrigin: `${iconCx}px ${iconCy}px` }}
            onMouseEnter={() => setHoveredSat(i)}
            onMouseLeave={() => setHoveredSat(null)}
          >
            {/* Fundo do Card Espaçoso */}
            <rect
              x={sat.x}
              y={sat.y}
              width="200"
              height="60"
              rx="12"
              fill="#18191C"
              stroke={isHovered || isCoreHovered ? "#C2694A" : "rgba(194, 105, 74, 0.45)"}
              strokeWidth={isHovered || isCoreHovered ? "1.8" : "1.3"}
              className="inst-satellite-card inst-node-pop"
              style={{ animationDelay: sat.delay }}
            />

            {/* Fundo do Círculo do Ícone */}
            <circle
              cx={iconCx}
              cy={iconCy}
              r="17"
              fill="#222428"
              stroke="rgba(217, 204, 181, 0.22)"
              strokeWidth="1.2"
              className="inst-node-pop"
              style={{ animationDelay: sat.delay }}
            />

            {/* Anel de Halo Animado (Pulsa radiantemente no hover do núcleo ou do card) */}
            <circle
              className="inst-sat-icon-halo"
              cx={iconCx}
              cy={iconCy}
              r="17"
              fill="none"
              stroke={sat.iconColor}
              strokeWidth="1.6"
              opacity={isCoreHovered || isHovered ? "0.9" : "0.35"}
            />

            {/* O Ícone Vetorial Dedicado com Animação */}
            {sat.icon}

            {/* Título Principal com Tipografia Nítida */}
            <text
              x={sat.x + 58}
              y={sat.y + 27}
              fontSize="12.5"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.05em"
              fontFamily="Libre Franklin, Arial, sans-serif"
              className="inst-node-label"
              style={{ animationDelay: `${parseFloat(sat.delay) + 0.15}s` }}
            >
              {sat.title}
            </text>

            {/* Subtítulo Explicativo */}
            <text
              x={sat.x + 58}
              y={sat.y + 45}
              fontSize="10"
              fontWeight="500"
              fill="rgba(217, 204, 181, 0.78)"
              letterSpacing="0.02em"
              fontFamily="Libre Franklin, Arial, sans-serif"
              className="inst-node-label"
              style={{ animationDelay: `${parseFloat(sat.delay) + 0.25}s` }}
            >
              {sat.sub}
            </text>

            {/* Led de Status no canto superior direito */}
            <circle
              cx={sat.x + 185}
              cy={sat.y + 17}
              r="6.5"
              fill={sat.statusColor}
              opacity="0.22"
            />
            <circle
              cx={sat.x + 185}
              cy={sat.y + 17}
              r="3.5"
              fill={sat.statusColor}
            />
          </g>
        );
      })}

      {/* Rótulo Institucional de Base */}
      <g className="inst-node" style={{ transformOrigin: "320px 420px" }}>
        <text
          x="320"
          y="422"
          textAnchor="middle"
          fill={isCoreHovered ? "#FFFFFF" : TERRA_LIGHT}
          fontSize="11.5"
          fontWeight="800"
          letterSpacing="2.5"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.6s", transition: "all 0.3s ease" }}
        >
          {isCoreHovered
            ? "✦ NÚCLEO ATIVO · 4 DOMÍNIOS OPERACIONAIS SINCRONIZADOS ✦"
            : "RSBUILD OS · NÚCLEO DE GOVERNANÇA INTEGRADA"}
        </text>
      </g>
    </svg>
  );
}

/** Governança: linha vertical que se desenha + nós sequenciais (seção escura). */
export function GovernanceFlow({ items }: { items: string[] }) {
  const { ref, visible } = useInView<SVGSVGElement>(0.3);
  const W = 280, H = 60 + items.length * 84;
  const x = 34;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={`inst-svg${visible ? " is-visible" : ""}`} role="img" aria-label="Ciclo de governança">
      <line className="inst-conn" x1={x} y1={44} x2={x} y2={H - 36} stroke={TERRA_LIGHT} strokeWidth="2" pathLength={100}
        style={{ animationDelay: "0.2s" }} />
      {items.map((label, i) => {
        const cy = 64 + i * 84;
        return (
          <g key={label}>
            <circle className="inst-node-glow" cx={x} cy={cy} r={13} fill="none" stroke={TERRA_LIGHT} strokeWidth="1.5"
              style={{ animationDelay: `${0.9 + i * 0.45}s` }} />
            <circle className="inst-node-pop" cx={x} cy={cy} r={6} fill={TERRA_LIGHT}
              style={{ animationDelay: `${0.9 + i * 0.45}s` }} />
            <text className="inst-node-label" x={x + 22} y={cy + 4} fontSize="13.5" fontWeight="600" fill={BEIGE}
              fontFamily="Libre Franklin, Arial, sans-serif"
              style={{ animationDelay: `${1.05 + i * 0.45}s` }}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}
