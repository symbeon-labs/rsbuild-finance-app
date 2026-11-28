"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface SuggestionReward {
  id: string;
  reward_type: "badge" | "point" | "tier";
  reward_value: string;
  granted_at: string;
  metadata: {
    response_days?: number;
    category?: string;
    description?: string;
  };
}

interface UserSuggestionStats {
  total_suggestions: number;
  improvement_suggestions: number;
  resolved_suggestions: number;
  total_rewards: number;
  rewards: string[];
}

const REWARD_META: Record<string, { label: string; icon: string; color: string }> = {
  "improvement-hero": { label: "Herói da Melhoria", icon: "⭐", color: "#FFD700" },
  "improvement-champion": { label: "Campeão da Melhoria", icon: "🏆", color: "#FF6B6B" },
  "improvement-voter": { label: "Votante Ativo", icon: "🌟", color: "#4ECDC4" },
};

export function SuggestionRewardsBadge({ organizationId }: { organizationId: string }) {
  const [stats, setStats] = useState<UserSuggestionStats | null>(null);
  const [recentRewards, setRecentRewards] = useState<SuggestionReward[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load stats
        const { data: statsData } = await supabase
          .from("user_suggestion_stats")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .single();

        if (statsData) {
          setStats(statsData as UserSuggestionStats);
        }

        // Load recent rewards
        const { data: rewardsData } = await supabase
          .from("suggestion_rewards")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .order("granted_at", { ascending: false })
          .limit(5);

        if (rewardsData) {
          setRecentRewards(rewardsData as SuggestionReward[]);
        }
      } catch (error) {
        console.error("Failed to load suggestion rewards:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [organizationId, supabase]);

  if (loading || !stats || stats.total_rewards === 0) {
    return null;
  }

  const topReward = recentRewards[0];
  const rewardMeta = topReward ? REWARD_META[topReward.reward_value] : null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "90px",
        right: "24px",
        zIndex: 999,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        overflow: "hidden",
        maxWidth: isExpanded ? "300px" : "200px",
        transition: "all 0.3s ease"
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(181, 88, 60, 0.1) 0%, rgba(181, 88, 60, 0.05) 100%)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          textAlign: "left"
        }}
      >
        <span style={{ fontSize: "20px" }}>{rewardMeta?.icon || "🌟"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
            {rewardMeta?.label || "Reconhecimento"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--muted)" }}>
            {stats.total_rewards} recompensa(s)
          </div>
        </div>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>
              Suas Contribuições
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                  {stats.total_suggestions}
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>Total</div>
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
                  {stats.resolved_suggestions}
                </div>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>Resolvidas</div>
              </div>
            </div>
          </div>

          {recentRewards.length > 0 && (
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px" }}>
                Últimas Recompensas
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentRewards.slice(0, 3).map(reward => {
                  const meta = REWARD_META[reward.reward_value];
                  return (
                    <div
                      key={reward.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        background: "var(--bg)",
                        borderRadius: "6px",
                        fontSize: "11px"
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>{meta?.icon || "🏅"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{meta?.label || reward.reward_value}</div>
                        <div style={{ color: "var(--muted)", fontSize: "10px" }}>
                          {new Date(reward.granted_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: "10px", color: "var(--muted)", textAlign: "center" }}>
              Suas sugestões ajudam a melhorar o RSBUILD
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
