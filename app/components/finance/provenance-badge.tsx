"use client";

import { useState } from "react";
import { type ReverseImportResult } from "@/lib/reverse-import";
import { type ProvenanceInfo } from "@/lib/import-export-traceability";

interface ProvenanceBadgeProps {
  provenance: ProvenanceInfo;
  showDetails?: boolean;
}

export function ProvenanceBadge({ provenance, showDetails = false }: ProvenanceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getBadgeStyle = () => {
    switch (provenance.source) {
      case "rsbuild_export":
        return {
          background: "var(--rsbuild-terracotta-soft)",
          color: "var(--rsbuild-terracotta)",
          border: "1px solid var(--rsbuild-terracotta)"
        };
      case "erp_direct":
        return {
          background: "var(--success-soft)",
          color: "var(--success)",
          border: "1px solid var(--success)"
        };
      default:
        return {
          background: "var(--bg)",
          color: "var(--muted)",
          border: "1px solid var(--line)"
        };
    }
  };

  const getSourceLabel = () => {
    switch (provenance.source) {
      case "rsbuild_export":
        return "RSBUILD OS Export";
      case "erp_direct":
        return "ERP Direto";
      default:
        return "Importação Manual";
    }
  };

  const getSourceIcon = () => {
    switch (provenance.source) {
      case "rsbuild_export":
        return "🔄";
      case "erp_direct":
        return "🏢";
      default:
        return "📄";
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          ...getBadgeStyle(),
          padding: "4px 8px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          cursor: showDetails ? "pointer" : "default"
        }}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
      >
        <span>{getSourceIcon()}</span>
        {getSourceLabel()}
        {provenance.isRoundTrip && <span style={{ marginLeft: "2px" }}>↩️</span>}
      </span>

      {showDetails && isExpanded && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            padding: "12px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            fontSize: "11px",
            minWidth: "200px",
            zIndex: 1000
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>Proveniência</div>
          {provenance.originalOrganizationId && (
            <div style={{ marginBottom: "4px" }}>
              <strong>Org. Original:</strong> {provenance.originalOrganizationId}
            </div>
          )}
          {provenance.originalExportDate && (
            <div style={{ marginBottom: "4px" }}>
              <strong>Data Exportação:</strong> {new Date(provenance.originalExportDate).toLocaleDateString("pt-BR")}
            </div>
          )}
          {provenance.originalExportType && (
            <div style={{ marginBottom: "4px" }}>
              <strong>Tipo:</strong> {provenance.originalExportType}
            </div>
          )}
          {provenance.isRoundTrip && (
            <div style={{ color: "var(--rsbuild-terracotta)", fontWeight: 600 }}>
              ⚠️ Round-trip detectado
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ReverseImportAlertProps {
  result: ReverseImportResult;
  onDismiss?: () => void;
}

export function ReverseImportAlert({ result, onDismiss }: ReverseImportAlertProps) {
  if (!result.isRoundTrip && !result.metadata) return null;

  return (
    <div
      className="alert alert-warning"
      style={{
        padding: "12px 16px",
        marginBottom: "16px",
        borderRadius: "8px",
        background: result.isRoundTrip ? "var(--rsbuild-terracotta-soft)" : "var(--bg)",
        border: `1px solid ${result.isRoundTrip ? "var(--rsbuild-terracotta)" : "var(--line)"}`,
        display: "flex",
        alignItems: "flex-start",
        gap: "12px"
      }}
    >
      <span style={{ fontSize: "20px" }}>{result.isRoundTrip ? "🔄" : "ℹ️"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          {result.isRoundTrip ? "Importação Reversa Detectada" : "Arquivo Exportado pelo RSBUILD"}
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
          {result.metadata && (
            <>
              Exportado em {new Date(result.metadata.exportDate).toLocaleDateString("pt-BR")} por {result.metadata.organizationName}
              {result.metadata.recordCount > 0 && ` (${result.metadata.recordCount} registros)`}
            </>
          )}
          {result.isRoundTrip && (
            <div style={{ marginTop: "4px", color: "var(--rsbuild-terracotta)" }}>
              Os registros manterão proveniência rastreável para auditoria.
            </div>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
            color: "var(--muted)"
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
