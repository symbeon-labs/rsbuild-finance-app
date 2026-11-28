"use client";

import { useState, useEffect, useRef } from "react";
import { GuideStep } from "@/lib/guide-types";

interface GuideBalloonProps {
  guideId: string;
  steps: GuideStep[];
  onComplete?: () => void;
  autoStart?: boolean;
}

export function GuideBalloon({ guideId, steps, onComplete, autoStart = true }: GuideBalloonProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const balloonRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  // Check if user has seen this guide before
  useEffect(() => {
    const seen = localStorage.getItem(`guide-seen-${guideId}`);
    if (!seen && autoStart) {
      setIsVisible(true);
      setHasSeen(false);
    } else {
      setHasSeen(true);
    }
  }, [guideId, autoStart]);

  // Position balloon relative to target element
  useEffect(() => {
    if (!isVisible || !balloonRef.current || !arrowRef.current) return;

    const step = steps[currentStep];
    if (!step.targetSelector) return;

    const target = document.querySelector(step.targetSelector);
    if (!target) return;

    const targetRect = target.getBoundingClientRect();
    const balloonRect = balloonRef.current.getBoundingClientRect();
    const arrowRect = arrowRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let arrowTop = 0;
    let arrowLeft = 0;
    let arrowDirection = "bottom";

    switch (step.position || "bottom") {
      case "top":
        top = targetRect.top - balloonRect.height - 20;
        left = targetRect.left + targetRect.width / 2 - balloonRect.width / 2;
        arrowDirection = "bottom";
        arrowTop = balloonRect.height - 5;
        arrowLeft = balloonRect.width / 2 - arrowRect.width / 2;
        break;
      case "bottom":
        top = targetRect.bottom + 20;
        left = targetRect.left + targetRect.width / 2 - balloonRect.width / 2;
        arrowDirection = "top";
        arrowTop = -arrowRect.height + 5;
        arrowLeft = balloonRect.width / 2 - arrowRect.width / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - balloonRect.height / 2;
        left = targetRect.left - balloonRect.width - 20;
        arrowDirection = "right";
        arrowTop = balloonRect.height / 2 - arrowRect.height / 2;
        arrowLeft = balloonRect.width - 5;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - balloonRect.height / 2;
        left = targetRect.right + 20;
        arrowDirection = "left";
        arrowTop = balloonRect.height / 2 - arrowRect.height / 2;
        arrowLeft = -arrowRect.width + 5;
        break;
      case "center":
        top = window.innerHeight / 2 - balloonRect.height / 2;
        left = window.innerWidth / 2 - balloonRect.width / 2;
        arrowDirection = "none";
        break;
    }

    // Ensure balloon stays within viewport
    top = Math.max(10, Math.min(top, window.innerHeight - balloonRect.height - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - balloonRect.width - 10));

    balloonRef.current.style.top = `${top}px`;
    balloonRef.current.style.left = `${left}px`;
    arrowRef.current.style.top = `${arrowTop}px`;
    arrowRef.current.style.left = `${arrowLeft}px`;
    arrowRef.current.dataset.direction = arrowDirection;
  }, [currentStep, isVisible, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`guide-seen-${guideId}`, "true");
    setIsVisible(false);
    setHasSeen(true);
    onComplete?.();
  };

  const handleSkip = () => {
    localStorage.setItem(`guide-seen-${guideId}`, "true");
    setIsVisible(false);
    setHasSeen(true);
  };

  const handleRestart = () => {
    localStorage.removeItem(`guide-seen-${guideId}`);
    setCurrentStep(0);
    setIsVisible(true);
    setHasSeen(false);
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div
        className="guide-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 999,
          pointerEvents: "none"
        }}
      />

      {/* Balloon */}
      <div
        ref={balloonRef}
        className="guide-balloon"
        style={{
          position: "fixed",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "20px",
          maxWidth: "320px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          zIndex: 1000
        }}
      >
        {/* Arrow */}
        <div
          ref={arrowRef}
          className="guide-arrow"
          style={{
            position: "absolute",
            width: "16px",
            height: "16px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            transform: "rotate(45deg)",
            zIndex: -1
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {currentStep + 1} de {steps.length}
          </div>
          <button
            onClick={handleSkip}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "4px"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            Pular
          </button>
        </div>

        {/* Content */}
        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
          {step.title}
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--muted)", lineHeight: 1.5 }}>
          {step.description}
        </p>

        {/* Progress bar */}
        <div style={{ height: "4px", background: "var(--line)", borderRadius: "2px", marginBottom: "16px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${((currentStep + 1) / steps.length) * 100}%`,
              background: "var(--rsbuild-terracotta)",
              transition: "width 0.3s ease"
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <button
            onClick={handlePrevious}
            disabled={isFirst}
            className="secondary-button"
            style={{
              opacity: isFirst ? 0.5 : 1,
              cursor: isFirst ? "not-allowed" : "pointer"
            }}
          >
            ← Anterior
          </button>
          <button
            onClick={handleNext}
            className="primary-button"
            style={{ flex: 1 }}
          >
            {isLast ? "Concluir" : "Próximo →"}
          </button>
        </div>
      </div>
    </>
  );
}
