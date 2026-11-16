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

/** Hero: rede abstrata de nós com draw-on-load (dispara ao montar). */
export function HeroNetwork() {
  const { ref, visible } = useInView<SVGSVGElement>(0.1);
  const pts: Array<[number, number, boolean]> = [
    [60, 60, false], [200, 40, false], [340, 70, false],
    [90, 180, false], [230, 160, false], [360, 190, false],
    [150, 290, false], [300, 300, true]
  ];
  const lines: Array<[number, number, number, number]> = [
    [60, 60, 200, 40], [200, 40, 340, 70], [90, 180, 200, 40],
    [230, 160, 340, 70], [90, 180, 60, 60], [230, 160, 200, 40],
    [360, 190, 340, 70], [150, 290, 90, 180], [300, 300, 360, 190],
    [300, 300, 230, 160], [150, 290, 230, 160]
  ];
  return (
    <svg ref={ref} viewBox="0 0 420 340" className={`inst-svg${visible ? " is-visible" : ""}`} aria-hidden="true">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} className="inst-conn" x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={TERRA_LIGHT} strokeWidth="1.4" opacity="0.6" pathLength={100}
          style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
      ))}
      {pts.map(([x, y, core], i) => (
        <g key={i} className="inst-node">
          <circle className="inst-node-glow" cx={x} cy={y} r={core ? 16 : 12} fill="none" stroke={TERRA_LIGHT} strokeWidth="1.5"
            style={{ animationDelay: `${1.2 + i * 0.1}s` }} />
          <circle className="inst-node-pop" cx={x} cy={y} r={core ? 7 : 5}
            fill={core ? TERRA_LIGHT : TERRA}
            style={{ animationDelay: `${1.2 + i * 0.1}s` }} />
        </g>
      ))}
      <text x="300" y="330" fill={TERRA_LIGHT} fontSize="11" fontWeight="700" letterSpacing="2"
        fontFamily="Libre Franklin, Arial" className="inst-node-label"
        style={{ animationDelay: "2.1s" }}>GOVERNANÇA</text>
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
