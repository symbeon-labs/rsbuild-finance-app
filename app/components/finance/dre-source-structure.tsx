"use client";

import { useState } from "react";
import { DRE_SOURCE_MODEL } from "@/lib/dre-source-model";

type ShareKey = "ALS/CSN" | "P&L" | "RRT";
type ShareMap = Partial<Record<ShareKey, number>>;

export function DreSourceStructure() {
  const [tab, setTab] = useState<"als_csn" | "pl" | "rrt" | "rateios" | "regras">("als_csn");
  const unit = DRE_SOURCE_MODEL.units.find((item) => item.id === tab);

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="panel-heading">
        <div>
          <h2>Modelo gerencial de referência · 2026</h2>
          <p>Estrutura extraída da planilha original; valores ainda não reconciliados com o QA.</p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {DRE_SOURCE_MODEL.units.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "primary-button" : "secondary-button"}
            onClick={() => setTab(item.id as typeof tab)}
          >
            {item.name}
          </button>
        ))}
        <button className={tab === "rateios" ? "primary-button" : "secondary-button"} onClick={() => setTab("rateios")}>Rateios</button>
        <button className={tab === "regras" ? "primary-button" : "secondary-button"} onClick={() => setTab("regras")}>Regras de cálculo</button>
      </div>

      {unit ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {unit.groups.map(([name, items]) => (
            <article key={name} className="panel" style={{ padding: 14 }}>
              <h3 style={{ fontSize: 13, marginBottom: 10 }}>{name}</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      ) : tab === "rateios" ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Grupo de rateio</th><th>Origem</th><th>ALS/CSN</th><th>P&L</th><th>RRT</th></tr>
            </thead>
            <tbody>
              {DRE_SOURCE_MODEL.rateioRules.map((rule) => {
                const shares = rule.shares as ShareMap;
                const als = shares["ALS/CSN"];
                const pl = shares["P&L"];
                const rrt = shares.RRT;
                return (
                  <tr key={rule.name}>
                    <td>{rule.name}</td>
                    <td>{rule.source}</td>
                    <td>{als ?? "—"}{als !== undefined ? "%" : ""}</td>
                    <td>{pl ?? "—"}{pl !== undefined ? "%" : ""}</td>
                    <td>{rrt ?? "—"}{rrt !== undefined ? "%" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          {DRE_SOURCE_MODEL.rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      )}

      <div className="quality-footnote" style={{ marginTop: 14 }}>
        A planilha também contém uma aba ANUAL que consolida ALS/CSN, P&L e RRT. A estrutura acima documenta categorias e regras de alocação; não atribui automaticamente movimentações bancárias a essas linhas.
      </div>
    </section>
  );
}
