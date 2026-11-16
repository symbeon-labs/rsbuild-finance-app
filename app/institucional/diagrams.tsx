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
 * Substitui o antigo wireframe aleatório por uma representação artística e proprietária
 * do ecossistema RSBUILD OS: Cubo de governança, o monograma oficial "S" no centro,
 * e os 4 satélites operacionais (Finanças, Reconciliação, Logística e Auditoria)
 * com pulsos de dados e anéis orbitais em movimento.
 */
export function HeroNetwork() {
  const { ref, visible } = useInView<SVGSVGElement>(0.1);

  return (
    <svg
      ref={ref}
      viewBox="0 0 520 420"
      className={`inst-svg inst-hero-prism${visible ? " is-visible" : ""}`}
      role="img"
      aria-label="Prisma Isométrico de Governança RSBUILD OS e seus 4 domínios operacionais"
    >
      <defs>
        {/* Gradientes das faces isométricas */}
        <linearGradient id="faceTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C2694A" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#B5583C" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="faceLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#614943" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2B2C2E" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="faceRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B5583C" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2B2C2E" stopOpacity="0.6" />
        </linearGradient>
        {/* Glow do Núcleo */}
        <filter id="coreGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C2694A" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#B5583C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Anéis Orbitais Elípticos */}
      <g className="inst-orbital-rings" style={{ transformOrigin: "260px 210px" }}>
        <ellipse
          cx="260"
          cy="210"
          rx="185"
          ry="72"
          fill="none"
          stroke="rgba(217, 204, 181, 0.18)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          transform="rotate(-20 260 210)"
        />
        <ellipse
          cx="260"
          cy="210"
          rx="175"
          ry="65"
          fill="none"
          stroke="rgba(194, 105, 74, 0.22)"
          strokeWidth="1.2"
          strokeDasharray="6 8"
          transform="rotate(25 260 210)"
        />
      </g>

      {/* Linhas de Conexão com os 4 Satélites Operacionais */}
      {/* 1. Finanças & Caixa (Top-Left -> Vértice Superior Esquerdo) */}
      <line
        className="inst-conn"
        x1="120"
        y1="90"
        x2="173"
        y2="160"
        stroke={TERRA_LIGHT}
        strokeWidth="1.6"
        strokeDasharray="4 4"
        pathLength={100}
        style={{ animationDelay: "0.2s" }}
      />
      {/* 2. Reconciliação ERP (Top-Right -> Vértice Superior Direito) */}
      <line
        className="inst-conn"
        x1="400"
        y1="90"
        x2="347"
        y2="160"
        stroke={TERRA_LIGHT}
        strokeWidth="1.6"
        strokeDasharray="4 4"
        pathLength={100}
        style={{ animationDelay: "0.35s" }}
      />
      {/* 3. Logística & Expedição (Bottom-Left -> Vértice Inferior Esquerdo) */}
      <line
        className="inst-conn"
        x1="120"
        y1="340"
        x2="173"
        y2="260"
        stroke={TERRA_LIGHT}
        strokeWidth="1.6"
        strokeDasharray="4 4"
        pathLength={100}
        style={{ animationDelay: "0.5s" }}
      />
      {/* 4. Auditoria & Governança (Bottom-Right -> Vértice Inferior Direito) */}
      <line
        className="inst-conn"
        x1="400"
        y1="340"
        x2="347"
        y2="260"
        stroke={TERRA_LIGHT}
        strokeWidth="1.6"
        strokeDasharray="4 4"
        pathLength={100}
        style={{ animationDelay: "0.65s" }}
      />

      {/* Pulsos de Dados Vivos viajando para o centro */}
      <circle r="3.5" fill="#F5F1EA">
        <animateMotion
          path="M 120 90 L 173 160 L 260 210"
          dur="3.2s"
          repeatCount="indefinite"
          begin="0.5s"
        />
      </circle>
      <circle r="3.5" fill="#F5F1EA">
        <animateMotion
          path="M 400 90 L 347 160 L 260 210"
          dur="3.6s"
          repeatCount="indefinite"
          begin="1.2s"
        />
      </circle>
      <circle r="3.5" fill="#F5F1EA">
        <animateMotion
          path="M 120 340 L 173 260 L 260 210"
          dur="3.8s"
          repeatCount="indefinite"
          begin="0.8s"
        />
      </circle>
      <circle r="3.5" fill="#F5F1EA">
        <animateMotion
          path="M 400 340 L 347 260 L 260 210"
          dur="3.4s"
          repeatCount="indefinite"
          begin="1.5s"
        />
      </circle>

      {/* O PRISMA ISOMÉTRICO RSBUILD (Cubo de Governança 3D) */}
      <g className="inst-prism-body" style={{ transformOrigin: "260px 210px" }}>
        {/* Face Superior */}
        <polygon
          points="260,110 347,160 260,210 173,160"
          fill="url(#faceTop)"
          stroke="#C2694A"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Face Esquerda */}
        <polygon
          points="173,160 260,210 260,310 173,260"
          fill="url(#faceLeft)"
          stroke="#B5583C"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.55s" }}
        />
        {/* Face Direita */}
        <polygon
          points="260,210 347,160 347,260 260,310"
          fill="url(#faceRight)"
          stroke="#C2694A"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="inst-node-pop"
          style={{ animationDelay: "0.7s" }}
        />

        {/* Eixo Central Vertical de Sustentação */}
        <line
          x1="260"
          y1="110"
          x2="260"
          y2="310"
          stroke="rgba(217, 204, 181, 0.4)"
          strokeWidth="1.2"
          strokeDasharray="2 3"
        />

        {/* NÚCLEO CENTRAL DE GOVERNANÇA: Símbolo Oficial Monograma RSBUILD */}
        <g filter="url(#coreGlow)">
          <circle
            cx="260"
            cy="210"
            r="38"
            fill="#1E2024"
            stroke="#C2694A"
            strokeWidth="2"
            className="inst-node-glow"
          />
          {/* Monograma Oficial da RSBUILD centrado e estilizado */}
          <g transform="translate(260, 210) scale(0.24) translate(-276, -623)">
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

      {/* OS 4 SATÉLITES OPERACIONAIS (CHIPS INTERATIVOS DE ALTA RESOLUÇÃO) */}

      {/* 1. Finanças & Caixa */}
      <g className="inst-node" style={{ transformOrigin: "115px 90px" }}>
        <rect
          x="15"
          y="72"
          width="150"
          height="36"
          rx="8"
          fill="#1C1D20"
          stroke="#C2694A"
          strokeWidth="1.3"
          className="inst-node-pop"
          style={{ animationDelay: "0.8s" }}
        />
        <circle cx="32" cy="90" r="4" fill="#10B981" />
        <text
          x="44"
          y="94"
          fontSize="11"
          fontWeight="700"
          fill="#F5F1EA"
          letterSpacing="0.8"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "0.95s" }}
        >
          FINANÇAS &amp; CAIXA
        </text>
      </g>

      {/* 2. Reconciliação ERP */}
      <g className="inst-node" style={{ transformOrigin: "410px 90px" }}>
        <rect
          x="355"
          y="72"
          width="155"
          height="36"
          rx="8"
          fill="#1C1D20"
          stroke="#C2694A"
          strokeWidth="1.3"
          className="inst-node-pop"
          style={{ animationDelay: "1.0s" }}
        />
        <circle cx="372" cy="90" r="4" fill="#10B981" />
        <text
          x="384"
          y="94"
          fontSize="11"
          fontWeight="700"
          fill="#F5F1EA"
          letterSpacing="0.8"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.15s" }}
        >
          RECONCILIAÇÃO ERP
        </text>
      </g>

      {/* 3. Logística & Expedição */}
      <g className="inst-node" style={{ transformOrigin: "115px 340px" }}>
        <rect
          x="15"
          y="322"
          width="155"
          height="36"
          rx="8"
          fill="#1C1D20"
          stroke="rgba(217, 204, 181, 0.45)"
          strokeWidth="1.3"
          className="inst-node-pop"
          style={{ animationDelay: "1.2s" }}
        />
        <circle cx="32" cy="340" r="4" fill="#F59E0B" />
        <text
          x="44"
          y="344"
          fontSize="11"
          fontWeight="700"
          fill="#F5F1EA"
          letterSpacing="0.8"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.35s" }}
        >
          EXPEDIÇÃO &amp; PROVAS
        </text>
      </g>

      {/* 4. Auditoria & Guardião */}
      <g className="inst-node" style={{ transformOrigin: "410px 340px" }}>
        <rect
          x="355"
          y="322"
          width="155"
          height="36"
          rx="8"
          fill="#1C1D20"
          stroke="rgba(217, 204, 181, 0.45)"
          strokeWidth="1.3"
          className="inst-node-pop"
          style={{ animationDelay: "1.4s" }}
        />
        <circle cx="372" cy="340" r="4" fill="#F59E0B" />
        <text
          x="384"
          y="344"
          fontSize="11"
          fontWeight="700"
          fill="#F5F1EA"
          letterSpacing="0.8"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.55s" }}
        >
          AUDITORIA &amp; ALÇADAS
        </text>
      </g>

      {/* Rótulo Institucional de Base */}
      <g className="inst-node" style={{ transformOrigin: "260px 380px" }}>
        <text
          x="260"
          y="386"
          textAnchor="middle"
          fill={TERRA_LIGHT}
          fontSize="11.5"
          fontWeight="800"
          letterSpacing="2.5"
          fontFamily="Libre Franklin, Arial, sans-serif"
          className="inst-node-label"
          style={{ animationDelay: "1.8s" }}
        >
          RSBUILD OS · NÚCLEO DE GOVERNANÇA
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
