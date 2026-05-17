import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { AlertTriangle, TrendingUp, Brain } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { FEATURE_NAMES, FEATURE_LABELS, vectorize } from "@/lib/ml";

export const Route = createFileRoute("/_authenticated/analytics")({ component: AnalyticsPage });

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return num / (Math.sqrt(dx * dy) || 1);
}

function AnalyticsPage() {
  const { user } = useAuth();
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("*")).data ?? [],
  });

  const { corr, risk, recommendations, toppers } = useMemo(() => {
    if (students.length < 5) return { corr: [], risk: [], recommendations: [], toppers: [] };
    const X = students.map((s: any) => vectorize(s));
    const y = students.map((s: any) => Number(s.actual_marks ?? 0));
    const corr = FEATURE_NAMES.map((f, i) => ({
      name: FEATURE_LABELS[f], value: +pearson(X.map((r) => r[i]), y).toFixed(2),
    })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const sorted = [...students].sort((a: any, b: any) => Number(a.actual_marks ?? 0) - Number(b.actual_marks ?? 0));
    const risk = sorted.slice(0, 8);
    const toppers = sorted.slice(-5).reverse();

    const recommendations = corr.slice(0, 3).map((c) => ({
      feat: c.name,
      msg: c.value > 0
        ? `Increasing ${c.name.toLowerCase()} correlates strongly (${c.value}) with higher marks. Focus interventions here.`
        : `${c.name} shows negative correlation (${c.value}). Investigate the relationship — may indicate quality vs. quantity issues.`,
    }));

    return { corr, risk, recommendations, toppers };
  }, [students]);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Correlations, risk detection, and AI-generated recommendations" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="size-4 text-accent" />Feature ↔ Marks Correlation</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corr} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis type="number" domain={[-1, 1]} stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.03 260)" fontSize={11} width={110} />
              <Tooltip contentStyle={{ background: "oklch(0.23 0.04 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {corr.map((c, i) => <Cell key={i} fill={c.value >= 0 ? "oklch(0.74 0.18 155)" : "oklch(0.68 0.22 15)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" />At-Risk Students</h3>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {risk.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/10">
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">#{s.student_code} • Attendance {s.attendance}% • Study {Number(s.study_hours).toFixed(1)}h</div>
                </div>
                <div className="text-lg font-bold text-destructive">{s.actual_marks ?? "—"}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Top Performers</h3>
          <div className="space-y-2">
            {toppers.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5">
                <div className="size-8 rounded-full btn-gradient flex items-center justify-center text-xs font-bold">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">#{s.student_code}</div>
                </div>
                <div className="text-lg font-bold text-gradient">{s.actual_marks}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Brain className="size-4 text-primary" />AI Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((r, i) => (
              <div key={i} className="rounded-lg p-3 bg-primary/5 border border-primary/20">
                <div className="text-xs font-semibold text-primary mb-1">{r.feat}</div>
                <p className="text-sm text-foreground/85">{r.msg}</p>
              </div>
            ))}
            {recommendations.length === 0 && <p className="text-sm text-muted-foreground">Need at least 5 student records to generate insights.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
