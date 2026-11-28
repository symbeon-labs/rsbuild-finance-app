"use client";

import { useState, useEffect } from "react";

interface AIPetButtonProps {
  organizationId?: string;
  onOpenFeedback?: () => void;
  onOpenGuides?: () => void;
}

export function AIPetButton({ organizationId, onOpenFeedback, onOpenGuides }: AIPetButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [eyeBlink, setEyeBlink] = useState(false);

  // Eye blinking animation
  useEffect(() => {
    const interval = setInterval(() => {
      setEyeBlink(true);
      setTimeout(() => setEyeBlink(false), 150);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleFeedback = () => {
    setIsMenuOpen(false);
    onOpenFeedback?.();
  };

  const handleGuides = () => {
    setIsMenuOpen(false);
    onOpenGuides?.();
  };

  return (
    <>
      {/* Pet Container */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1000
        }}
      >
        {/* Pet Avatar */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2B2C2E 0%, #614943 100%)",
            border: "3px solid var(--surface)",
            boxShadow: isHovered 
              ? "0 12px 32px rgba(181, 88, 60, 0.5)" 
              : "0 8px 24px rgba(0,0,0,0.3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: isHovered ? "scale(1.1)" : "scale(1)",
            position: "relative"
          }}
        >
          {/* Eyes */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                width: "8px",
                height: eyeBlink ? "2px" : "8px",
                borderRadius: "50%",
                background: isHovered ? "#FFD700" : "#fff",
                transition: "all 0.15s ease",
                boxShadow: isHovered ? "0 0 8px #FFD700" : "none"
              }}
            />
            <div
              style={{
                width: "8px",
                height: eyeBlink ? "2px" : "8px",
                borderRadius: "50%",
                background: isHovered ? "#FFD700" : "#fff",
                transition: "all 0.15s ease",
                boxShadow: isHovered ? "0 0 8px #FFD700" : "none"
              }}
            />
          </div>

          {/* Mouth (smile when hovered) */}
          <div
            style={{
              position: "absolute",
              bottom: "14px",
              width: "16px",
              height: "8px",
              borderBottom: isHovered ? "2px solid #fff" : "2px solid #D9CCB5",
              borderRadius: "0 0 8px 8px",
              transition: "all 0.3s ease"
            }}
          />
        </div>

        {/* Speech Bubble */}
        {isHovered && !isMenuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              right: "0",
              background: "var(--surface)",
              padding: "8px 12px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              fontSize: "12px",
              color: "var(--ink)",
              whiteSpace: "nowrap",
              animation: "fadeIn 0.2s ease"
            }}
          >
            Como posso ajudar?
            <div
              style={{
                position: "absolute",
                bottom: "-6px",
                right: "20px",
                width: "0",
                height: "0",
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "6px solid var(--surface)"
              }}
            />
          </div>
        )}

        {/* Menu */}
        {isMenuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "75px",
              right: "0",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              minWidth: "220px",
              overflow: "hidden",
              animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                background: "linear-gradient(135deg, rgba(181, 88, 60, 0.1) 0%, rgba(181, 88, 60, 0.05) 100%)",
                borderBottom: "1px solid var(--line)",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--ink)"
              }}
            >
              Como posso ajudar?
            </div>

            <button
              onClick={handleGuides}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "var(--ink)",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: "18px" }}>📖</span>
              <div>
                <div>Guias de Ajuda</div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  Aprenda a usar cada funcionalidade
                </div>
              </div>
            </button>

            <button
              onClick={handleFeedback}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
                color: "var(--ink)",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontSize: "18px" }}>💬</span>
              <div>
                <div>Feedback e Sugestões</div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  Conte-nos sua experiência
                </div>
              </div>
            </button>

            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--line)",
                background: "rgba(181, 88, 60, 0.05)",
                fontSize: "11px",
                color: "var(--muted)",
                textAlign: "center"
              }}
            >
              Sua opinião ajuda a melhorar o RSBUILD
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
