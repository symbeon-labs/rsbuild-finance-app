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
 * Diagramação executiva de alta resolução — v2:
 * Cubo escalado (apex y=110, base y=350), prism center (410,230),
 * cards 310×84px com tipografia 15px/12.5px, ícone r=24,
 * viewBox 860×480 para máxima presença visual no espaço disponível.
 */
export function HeroNetwork() {
  const { ref, visible } = useInView<SVGSVGElement>(0.1);
  const [isCoreHovered, setIsCoreHovered] = useState(false);
  const [hoveredSat, setHoveredSat] = useState<number | null>(null);

  /* ── Dimensões do canvas ────────────────────────────────────────── */
  /* viewBox 860×480: 5% mais largo que o anterior para respirar      */
  /* Prism center: (430, 240). Vértices do cubo escalado:             */
  /*   Apex top: (430, 110)                                           */
  /*   Mid-left: (348, 164)   Mid-right: (512, 164)                  */
  /*   Center:   (430, 240)                                           */
  /*   Bot-left: (348, 316)   Bot-right: (512, 316)                  */
  /*   Base bot: (430, 350)   (altura total do prism: 240px vs 190px) */

  const SATELLITES = [
    {
      id: "financas",
      title: "FINANÇAS & CAIXA",
      sub: "Fluxo de caixa, extratos & liquidez",
      x: 10,
      y: 38,
      width: 310,
      height: 84,
      iconColor: "#10B981",
      statusColor: "#10B981",
      delay: "0.8s",
      anchorX: 320,
      anchorY: 80,
      cubeX: 348,
      cubeY: 164,
      path: "M 320 80 L 348 164 L 430 240",
      revPath: "M 430 240 L 348 164 L 320 80",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "52px 80px" }}>
          <rect x="40" y="68" width="24" height="21" rx="3.5" fill="none" stroke="#10B981" strokeWidth="1.9" />
          <circle cx="52" cy="78.5" r="4.2" fill="none" stroke="#10B981" strokeWidth="1.9" />
          <path d="M44 78.5h1.8M60.2 78.5H62" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    },
    {
      id: "reconciliacao",
      title: "RECONCILIAÇÃO ERP",
      sub: "ERP & conciliação de baixas",
      x: 540,
      y: 38,
      width: 310,
      height: 84,
      iconColor: "#34D399",
      statusColor: "#10B981",
      delay: "0.95s",
      anchorX: 540,
      anchorY: 80,
      cubeX: 512,
      cubeY: 164,
      path: "M 540 80 L 512 164 L 430 240",
      revPath: "M 430 240 L 512 164 L 540 80",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "578px 80px" }}>
          <path d="M588 73A8.5 8.5 0 0 0 572.5 70L570 72.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="570 67 570 72.5 575.5 72.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M570 87A8.5 8.5 0 0 0 585.5 90L588 87.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="588 93 588 87.5 582.5 87.5" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    },
    {
      id: "expedicao",
      title: "EXPEDIÇÃO & PROVAS",
      sub: "Canhotos, NF-e & tracking",
      x: 10,
      y: 358,
      width: 310,
      height: 84,
      iconColor: "#F59E0B",
      statusColor: "#F59E0B",
      delay: "1.1s",
      anchorX: 320,
      anchorY: 400,
      cubeX: 348,
      cubeY: 316,
      path: "M 320 400 L 348 316 L 430 240",
      revPath: "M 430 240 L 348 316 L 320 400",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "52px 400px" }}>
          <rect x="40" y="390" width="15" height="13" rx="2" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
          <path d="M55 393.5h6l4 4v5H55v-9z" fill="none" stroke="#F59E0B" strokeWidth="1.9" strokeLinejoin="round" />
          <circle cx="45" cy="406" r="3" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
          <circle cx="60" cy="406" r="3" fill="none" stroke="#F59E0B" strokeWidth="1.9" />
        </g>
      )
    },
    {
      id: "auditoria",
      title: "AUDITORIA & ALÇADAS",
      sub: "Regra Raquel & governança",
      x: 540,
      y: 358,
      width: 310,
      height: 84,
      iconColor: "#C2694A",
      statusColor: "#F59E0B",
      delay: "1.25s",
      anchorX: 540,
      anchorY: 400,
      cubeX: 512,
      cubeY: 316,
      path: "M 540 400 L 512 316 L 430 240",
      revPath: "M 430 240 L 512 316 L 540 400",
      icon: (
        <g className="inst-sat-icon-shape" style={{ transformOrigin: "578px 400px" }}>
          <path d="M578 388l9 3.3v6.6c0 6-4.8 10-9 11.5-4.2-1.5-9-5.5-9-11.5v-6.6l9-3.3z" fill="none" stroke="#C2694A" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M574 397l2.8 2.8 6.2-6.2" fill="none" stroke="#C2694A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }
  ];

  return (
    <svg
      ref={ref}
      viewBox="0 0 860 480"
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
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Anéis Orbitais Elípticos — escalados para o novo canvas */}
      <g className="inst-orbital-rings" style={{ transformOrigin: "430px 240px" }}>
        <ellipse
          cx="430"
          cy="240"
          rx="250"
          ry="92"
          fill="none"
          stroke="rgba(217, 204, 181, 0.16)"
          strokeWidth="1.3"
          strokeDasharray="4 6"
          transform="rotate(-16 430 240)"
        />
        <ellipse
          cx="430"
          cy="240"
          rx="232"
          ry="84"
          fill="none"
          stroke="rgba(194, 105, 74, 0.22)"
          strokeWidth="1.3"
          strokeDasharray="6 8"
          transform="rotate(20 430 240)"
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
            strokeWidth={isHovered || isCoreHovered ? "2.4" : "1.8"}
            strokeDasharray={isHovered || isCoreHovered ? "none" : "4 4"}
            opacity={isHovered || isCoreHovered ? 1 : 0.65}
            pathLength={100}
            style={{ animationDelay: `${0.2 + i * 0.15}s`, transition: "all 0.3s ease" }}
          />
        );
      })}

      {/* Pulsos de Dados Vivos: viagem contínua ao centro */}
      {SATELLITES.map((sat, i) => (
        <circle key={`pulse-in-${sat.id}`} r="4" fill="#F5F1EA" opacity="0.9">
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
          <circle key={`pulse-out-${sat.id}`} r="4.5" fill="#C2694A" opacity="0.95">
            <animateMotion
              path={sat.revPath}
              dur="1.6s"
              repeatCount="indefinite"
              begin={`${i * 0.2}s`}
            />
          </circle>
        ))}

      {/* O PRISMA ISOMÉTRICO RSBUILD — escalado (apex 110, base 350) */}
      <g
        className="inst-prism-body inst-core-trigger"
        style={{ transformOrigin: "430px 240px" }}
        onMouseEnter={() => setIsCoreHovered(true)}
        onMouseLeave={() => setIsCoreHovered(false)}
        tabIndex={0}
        role="button"
        aria-label="Núcleo de Governança RSBUILD OS — Passe o mouse para sincronizar os 4 domínios"
      >
        {/* Face Superior */}
        <polygon
          points="430,110 512,164 430,240 348,164"
          fill="url(#faceTop)"
          stroke="#C2694A"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Face Esquerda */}
        <polygon
          points="348,164 430,240 430,350 348,316"
          fill="url(#faceLeft)"
          stroke="#B5583C"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.55s" }}
        />
        {/* Face Direita */}
        <polygon
          points="430,240 512,164 512,316 430,350"
          fill="url(#faceRight)"
          stroke="#C2694A"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.7s" }}
        />

        {/* Eixo Central Vertical de Sustentação */}
        <line
          x1="430"
          y1="110"
          x2="430"
          y2="350"
          stroke="rgba(217, 204, 181, 0.45)"
          strokeWidth="1.3"
          strokeDasharray="2 3"
        />

        {/* Halo de irradiação concêntrica ativo no hover do núcleo */}
        {isCoreHovered && (
          <circle
            cx="430"
            cy="240"
            r="60"
            fill="none"
            stroke="#C2694A"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            className="inst-sat-icon-halo"
          />
        )}

        {/* NÚCLEO CENTRAL DE GOVERNANÇA: Monograma Oficial da RSBUILD — r=48 */}
        <g filter="url(#coreGlow)">
          <circle
            cx="430"
            cy="240"
            r="48"
            fill="#1E2024"
            stroke={isCoreHovered ? "#FFFFFF" : "#C2694A"}
            strokeWidth={isCoreHovered ? "2.6" : "2.2"}
            className="inst-node-glow"
          />
          {/* Monograma Oficial da RSBUILD — scale 0.30 para aproveitar o r=48 */}
          <g transform="translate(430, 240) scale(0.30) translate(-276, -623)">
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

      {/* OS 4 SATÉLITES OPERACIONAIS — cards 310×84px, ícone r=24 */}
      {SATELLITES.map((sat, i) => {
        const isHovered = hoveredSat === i;
        const iconCx = sat.x + 42;
        const iconCy = sat.y + 42;
        const textStartX = sat.x + 80;
        return (
          <g
            key={sat.id}
            className={`inst-satellite-group${isHovered ? " is-hovered" : ""}`}
            style={{ transformOrigin: `${iconCx}px ${iconCy}px` }}
            onMouseEnter={() => setHoveredSat(i)}
            onMouseLeave={() => setHoveredSat(null)}
          >
            {/* Fundo do Card Executivo */}
            <rect
              x={sat.x}
              y={sat.y}
              width={sat.width}
              height={sat.height}
              rx="16"
              fill="#18191C"
              stroke={isHovered || isCoreHovered ? "#C2694A" : "rgba(194, 105, 74, 0.45)"}
              strokeWidth={isHovered || isCoreHovered ? "2" : "1.4"}
              className="inst-satellite-card inst-node-pop"
              style={{ animationDelay: sat.delay }}
            />

            {/* Fundo do Círculo do Ícone — r=24 */}
            <circle
              cx={iconCx}
              cy={iconCy}
              r="24"
              fill="#222428"
              stroke="rgba(217, 204, 181, 0.22)"
              strokeWidth="1.3"
              className="inst-node-pop"
              style={{ animationDelay: sat.delay }}
            />

            {/* Anel de Halo Animado */}
            <circle
              className="inst-sat-icon-halo"
              cx={iconCx}
              cy={iconCy}
              r="24"
              fill="none"
              stroke={sat.iconColor}
              strokeWidth="2"
              opacity={isCoreHovered || isHovered ? "0.95" : "0.35"}
            />

            {/* O Ícone Vetorial Dedicado */}
            {sat.icon}

            {/* Título Principal — 15px weight 800 */}
            <text
              x={textStartX}
              y={sat.y + 36}
              fontSize="15"
              fontWeight="800"
              fill="#FFFFFF"
              letterSpacing="0.04em"
              fontFamily="Libre Franklin, Arial, sans-serif"
              className="inst-node-label"
              style={{ animationDelay: `${parseFloat(sat.delay) + 0.15}s` }}
            >
              {sat.title}
            </text>

            {/* Subtítulo Operacional — 12.5px */}
            <text
              x={textStartX}
              y={sat.y + 58}
              fontSize="12.5"
              fontWeight="500"
              fill="rgba(217, 204, 181, 0.82)"
              letterSpacing="0.02em"
              fontFamily="Libre Franklin, Arial, sans-serif"
              className="inst-node-label"
              style={{ animationDelay: `${parseFloat(sat.delay) + 0.25}s` }}
            >
              {sat.sub}
            </text>

            {/* Led de Status — canto superior direito */}
            <circle
              cx={sat.x + sat.width - 22}
              cy={sat.y + 22}
              r="9"
              fill={sat.statusColor}
              opacity="0.22"
            />
            <circle
              cx={sat.x + sat.width - 22}
              cy={sat.y + 22}
              r="4"
              fill={sat.statusColor}
            />
          </g>
        );
      })}

      {/* Rótulo Institucional de Base */}
      <g className="inst-node" style={{ transformOrigin: "430px 462px" }}>
        <text
          x="430"
          y="466"
          textAnchor="middle"
          fill={isCoreHovered ? "#FFFFFF" : TERRA_LIGHT}
          fontSize="13"
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
