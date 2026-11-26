"use client";

import { useState, useRef, useEffect } from "react";
import { type ErpFormat } from "@/lib/erp-export";

export type ExportFormat = "csv" | "excel" | "ofx";
export type ExportTarget = "dre" | "movimentacoes" | "baixas";

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: "excel",
    label: "Excel (.xlsx)",
    description: "Planilha com abas por unidade/conta",
    icon: "📊"
  },
  {
    format: "csv",
    label: "CSV Genérico",
    description: "Arquivo separado por ponto e vírgula",
    icon: "📄"
  },
  {
    format: "ofx",
    label: "OFX",
    description: "Formato padrão bancário brasileiro",
    icon: "🏦"
  }
];

interface ExportMenuProps {
  target: ExportTarget;
  onExport: (format: ExportFormat, erpFormat?: ErpFormat) => void;
  disabled?: boolean;
  className?: string;
  organizationId?: string;
}

export function ExportMenu({ target, onExport, disabled = false, className = "", organizationId = "" }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedFormat(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFormatSelect = (format: ExportFormat) => {
    if (format === "csv") {
      setSelectedFormat(format);
    } else {
      onExport(format);
      setIsOpen(false);
      setSelectedFormat(null);
    }
  };

  const handleErpSelect = (erpFormat: ErpFormat) => {
    onExport("csv", erpFormat);
    setIsOpen(false);
    setSelectedFormat(null);
  };

  const targetLabels: Record<ExportTarget, string> = {
    dre: "Exportar DRE",
    movimentacoes: "Exportar Movimentações",
    baixas: "Exportar Baixas"
  };

  const erpOptions: Array<{ format: ErpFormat; label: string; description: string }> = [
    { format: "omie", label: "Omie", description: "Formato específico Omie ERP" },
    { format: "bling", label: "Bling", description: "Formato específico Bling" },
    { format: "tiny", label: "Tiny", description: "Formato específico Tiny" },
    { format: "contaazul", label: "ContaAzul", description: "Formato específico ContaAzul" },
    { format: "generic", label: "Genérico", description: "CSV padrão sem ERP específico" }
  ];

  return (
    <div className={`export-menu ${className}`} ref={menuRef} style={{ position: "relative" }}>
      <button
        className="secondary-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        style={{ display: "flex", alignItems: "center", gap: "6px" }}
      >
        📥 Exportar
        <span style={{ fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div
          className="export-menu-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            minWidth: "200px",
            zIndex: 1000
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--line)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            {targetLabels[target]}
          </div>
          {selectedFormat === "csv" ? (
            <>
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                Selecionar ERP
              </div>
              {erpOptions.map((option) => (
                <button
                  key={option.format}
                  onClick={() => handleErpSelect(option.format)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: "16px" }}>🏢</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setSelectedFormat(null)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  borderTop: "1px solid var(--line)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "var(--muted)",
                  textAlign: "center"
                }}
              >
                ← Voltar
              </button>
            </>
          ) : (
            EXPORT_OPTIONS.map((option) => (
              <button
                key={option.format}
                onClick={() => handleFormatSelect(option.format)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "16px" }}>{option.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {option.description}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
