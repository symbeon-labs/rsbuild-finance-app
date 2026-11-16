"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulsePhase: number;
  isBeacon: boolean;
};

export function HeroAmbientAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let mouseActive = false;

    // Verificar se o usuário solicitou menos movimento
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx?.scale(dpr, dpr);
      initParticles();
    }

    function initParticles() {
      const count = Math.min(Math.floor((width * height) / 18000), 42);
      particles = [];
      for (let i = 0; i < count; i++) {
        const isBeacon = i % 7 === 0;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: isBeacon ? 3.2 : 1.8 + Math.random() * 1.2,
          baseAlpha: isBeacon ? 0.85 : 0.35 + Math.random() * 0.3,
          pulsePhase: Math.random() * Math.PI * 2,
          isBeacon
        });
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      mouseActive = true;
    }

    function handleMouseLeave() {
      mouseActive = false;
    }

    window.addEventListener("resize", resize);
    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener("mousemove", handleMouseMove);
      parent.addEventListener("mouseleave", handleMouseLeave);
    }

    resize();

    let time = 0;

    function render() {
      if (!ctx) return;
      time += 0.016;

      ctx.clearRect(0, 0, width, height);

      // 1. Orbes de Luz Atmosférica Viva (Gradientes Radiais Orgânicos)
      // Orbe 1: Terracota Superior / Centro-Direita
      const orb1X = width * 0.72 + Math.sin(time * 0.4) * 60;
      const orb1Y = height * 0.32 + Math.cos(time * 0.5) * 45;
      const grad1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, Math.max(width * 0.45, 320));
      grad1.addColorStop(0, "rgba(181, 88, 60, 0.24)");
      grad1.addColorStop(0.4, "rgba(194, 105, 74, 0.10)");
      grad1.addColorStop(1, "rgba(43, 44, 46, 0)");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Orbe 2: Âmbar/Warm Beige Inferior / Centro-Esquerda
      const orb2X = width * 0.28 + Math.cos(time * 0.35) * 55;
      const orb2Y = height * 0.68 + Math.sin(time * 0.45) * 40;
      const grad2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, Math.max(width * 0.4, 280));
      grad2.addColorStop(0, "rgba(217, 204, 181, 0.14)");
      grad2.addColorStop(0.45, "rgba(97, 73, 67, 0.08)");
      grad2.addColorStop(1, "rgba(43, 44, 46, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // Efeito de Mouse Glow sutil
      if (mouseActive && mouseX >= 0 && mouseY >= 0) {
        const mouseGrad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 160);
        mouseGrad.addColorStop(0, "rgba(194, 105, 74, 0.18)");
        mouseGrad.addColorStop(1, "rgba(43, 44, 46, 0)");
        ctx.fillStyle = mouseGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Conexões de Rede entre Partículas Próximas
      const maxDist = 135;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.25;
            ctx.strokeStyle = `rgba(194, 105, 74, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 3. Atualizar e Desenhar Nós da Constelação
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Rebatimento suave nas bordas
          if (p.x < 0) { p.x = 0; p.vx *= -1; }
          if (p.x > width) { p.x = width; p.vx *= -1; }
          if (p.y < 0) { p.y = 0; p.vy *= -1; }
          if (p.y > height) { p.y = height; p.vy *= -1; }

          // Interação magnética sutil com o cursor
          if (mouseActive) {
            const mdx = mouseX - p.x;
            const mdy = mouseY - p.y;
            const mdist = Math.hypot(mdx, mdy);
            if (mdist < 140 && mdist > 5) {
              const force = (1 - mdist / 140) * 0.3;
              p.x += (mdx / mdist) * force;
              p.y += (mdy / mdist) * force;
            }
          }
        }

        const pulse = Math.sin(time * 2 + p.pulsePhase);
        const currentAlpha = Math.max(0.15, Math.min(1, p.baseAlpha + pulse * 0.2));

        // Se for um nó de baliza ("Beacon"), desenha anel de pulso
        if (p.isBeacon) {
          const ringRadius = p.radius + 6 + pulse * 4;
          ctx.strokeStyle = `rgba(194, 105, 74, ${Math.max(0, 0.45 - (ringRadius / 20) * 0.3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, ringRadius), 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = `rgba(245, 241, 234, ${currentAlpha})`;
        } else {
          ctx.fillStyle = `rgba(194, 105, 74, ${currentAlpha})`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(render);
      }
    }

    if (prefersReducedMotion) {
      render();
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (parent) {
        parent.removeEventListener("mousemove", handleMouseMove);
        parent.removeEventListener("mouseleave", handleMouseLeave);
      }
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0
      }}
      aria-hidden="true"
    />
  );
}
