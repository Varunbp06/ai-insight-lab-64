import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, Line, LineChart, Cell, PieChart, Pie, Legend, BarChart, Bar,
} from "recharts";
import {
  BookOpen, Trophy, TrendingDown, TrendingUp, ShieldCheck, Sparkles, Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ALGORITHMS, FEATURE_NAMES, FEATURE_LABELS, gradeFor, metrics, predict,
  trainModel, vectorize, featureImportance, type Algorithm, type FeatureVector,
} from "@/lib/ml";
import { FEATURE_INPUT_RANGES } from "@/lib/seed";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function useStudents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["students", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("student_code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={50}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#sg-${color})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatCard({ title, value, suffix, delta, icon: Icon, color, sparkData, glow }: {
  title: string; value: string | number; suffix?: string; delta?: string; icon: React.ElementType; color: string; sparkData: number[]; glow?: string;
}) {
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm text-muted-foreground font-medium">{title}</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight">{value}</span>
            {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          </div>
          {delta && <div className={`text-xs mt-1 ${glow ?? "text-success"}`}>{delta}</div>}
        </div>
        <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, color }}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 -mx-2"><Sparkline data={sparkData} color={color} /></div>
    </GlassCard>
  );
}

function Dashboard() {
  const { data: students = [], isLoading } = useStudents();
  const [algo, setAlgo] = useState<Algorithm>("linear");
  const [inputs, setInputs] = useState<FeatureVector>(() => {
    const out = {} as FeatureVector;
    FEATURE_NAMES.forEach((k) => (out[k] = FEATURE_INPUT_RANGES[k].default));
    return out;
  });
  const [prediction, setPrediction] = useState<{ marks: number; grade: string; confidence: number } | null>(null);
  const [predicting, setPredicting] = useState(false);

  const { model, fi, modelMetrics, modelComparison } = useMemo(() => {
    if (students.length < 5) return { model: null, fi: null, modelMetrics: null, modelComparison: [] };
    const X = students.map((s: any) => vectorize(s));
    const y = students.map((s: any) => Number(s.actual_marks ?? s.predicted_marks ?? 0));
    const m = trainModel(algo, X, y);
    const preds = X.map((x) => predict(m, x));
    const mm = metrics(y, preds);
    const fi = featureImportance(m, X, y);
    const comparison = ALGORITHMS.map((a) => {
      const tmpModel = trainModel(a.id, X, y);
      const tmpPreds = X.map((x) => predict(tmpModel, x));
      const tmpMetrics = metrics(y, tmpPreds);
      return { name: a.label, accuracy: tmpMetrics.accuracy, rmse: tmpMetrics.rmse, r2: tmpMetrics.r2, active: a.id === algo };
    });
    return { model: m, fi, modelMetrics: mm, modelComparison: comparison };
  }, [students, algo]);

  const stats = useMemo(() => {
    if (!students.length) return null;
    const marks = students.map((s: any) => Number(s.actual_marks ?? 0));
    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
    const high = Math.max(...marks);
    const low = Math.min(...marks);
    const topIdx = marks.indexOf(high);
    const recent = marks.slice(-20);
    const earlier = marks.slice(0, 20);
    const earlyAvg = earlier.reduce((a, b) => a + b, 0) / Math.max(1, earlier.length);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const improvement = ((recentAvg - earlyAvg) / Math.max(1, earlyAvg)) * 100;
    return { avg, high, low, topCode: students[topIdx]?.student_code, improvement, marks };
  }, [students]);

  const handlePredict = async () => {
    if (!model) return toast.error("Need more data to train. Upload a dataset first.");
    setPredicting(true);
    await new Promise((r) => setTimeout(r, 350));
    const marks = predict(model, vectorize(inputs));
    const confidence = modelMetrics ? Math.max(0.5, Math.min(0.99, modelMetrics.r2)) : 0.75;
    setPrediction({ marks, grade: gradeFor(marks), confidence });
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("predictions").insert({
      owner_id: u.user!.id, model: algo, inputs: inputs as any, predicted_marks: marks, confidence, grade: gradeFor(marks),
    });
    setPredicting(false);
    toast.success(`Predicted ${marks.toFixed(0)}/100 (${gradeFor(marks)})`);
  };

  // Chart data
  const scatterData = students.map((s: any) => ({
    actual: Number(s.actual_marks ?? 0),
    predicted: model ? predict(model, vectorize(s)) : 0,
  }));
  const ideal = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
  const trendData = (() => {
    if (!students.length) return [];
    const buckets = 8;
    const size = Math.max(1, Math.floor(students.length / buckets));
    return Array.from({ length: buckets }, (_, b) => {
      const slice = students.slice(b * size, (b + 1) * size);
      const avg = slice.reduce((a, s: any) => a + Number(s.actual_marks ?? 0), 0) / Math.max(1, slice.length);
      const pred = model ? slice.reduce((a, s: any) => a + predict(model, vectorize(s)), 0) / Math.max(1, slice.length) : avg;
      return { week: `Wk ${b + 1}`, actual: +avg.toFixed(1), predicted: +pred.toFixed(1) };
    });
  })();
  const fiData = fi ? FEATURE_NAMES.map((f) => ({ name: FEATURE_LABELS[f], value: +(fi[f] * 100).toFixed(1) })).sort((a, b) => b.value - a.value) : [];
  const gradeBuckets = useMemo(() => {
    if (!stats) return [];
    const m = stats.marks;
    const a = m.filter((v) => v >= 80).length;
    const b = m.filter((v) => v >= 60 && v < 80).length;
    const c = m.filter((v) => v >= 40 && v < 60).length;
    const d = m.filter((v) => v < 40).length;
    const total = m.length || 1;
    return [
      { name: "A (80-100)", value: a, pct: Math.round((a / total) * 100), color: "oklch(0.74 0.18 155)" },
      { name: "B (60-79)", value: b, pct: Math.round((b / total) * 100), color: "oklch(0.72 0.18 230)" },
      { name: "C (40-59)", value: c, pct: Math.round((c / total) * 100), color: "oklch(0.78 0.18 60)" },
      { name: "D (<40)", value: d, pct: Math.round((d / total) * 100), color: "oklch(0.68 0.22 15)" },
    ];
  }, [stats]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Overview of student performance and model insights" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Average Marks" value={stats?.avg.toFixed(1) ?? "—"} suffix="/100" delta={`↑ ${(stats?.improvement ?? 0).toFixed(1)}% trend`} icon={BookOpen} color="oklch(0.72 0.18 230)" sparkData={stats?.marks.slice(-20) ?? []} />
        <StatCard title="Highest Score" value={stats?.high ?? "—"} suffix="/100" delta={`Top: #${stats?.topCode ?? "—"}`} icon={Trophy} color="oklch(0.7 0.21 270)" sparkData={(stats?.marks ?? []).slice(-20).map((v) => v)} />
        <StatCard title="Lowest Score" value={stats?.low ?? "—"} suffix="/100" delta="Students needing support" icon={TrendingDown} color="oklch(0.68 0.22 15)" sparkData={(stats?.marks ?? []).slice(0, 20).map((v) => v)} glow="text-destructive" />
        <StatCard title="Improvement Rate" value={`${(stats?.improvement ?? 0).toFixed(1)}%`} delta="rolling cohort" icon={TrendingUp} color="oklch(0.74 0.18 155)" sparkData={(stats?.marks ?? []).slice(-25).map((v) => v)} />
        <StatCard title="Model Status" value={modelMetrics ? "Healthy" : "Idle"} delta={modelMetrics ? `RMSE ${modelMetrics.rmse.toFixed(1)}` : "Awaiting data"} icon={ShieldCheck} color="oklch(0.74 0.18 155)" sparkData={(stats?.marks ?? []).slice(-15).map((v) => v)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Prediction System */}
        <GlassCard className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Prediction System</h3>
            <Select value={algo} onValueChange={(v) => setAlgo(v as Algorithm)}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ALGORITHMS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {FEATURE_NAMES.map((f) => {
              const r = FEATURE_INPUT_RANGES[f];
              return (
                <div key={f}>
                  <Label className="text-xs flex justify-between mb-1">
                    <span>{FEATURE_LABELS[f]} {r.unit && <span className="text-muted-foreground">({r.unit})</span>}</span>
                  </Label>
                  <Input type="number" step={r.step} min={r.min} max={r.max} value={inputs[f]} onChange={(e) => setInputs({ ...inputs, [f]: +e.target.value })} className="h-9" />
                </div>
              );
            })}
            <Button onClick={handlePredict} disabled={predicting} className="w-full btn-gradient border-0 mt-2">
              {predicting ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="size-4 mr-2" />Predict Marks</>}
            </Button>
          </div>
        </GlassCard>

        {/* Prediction Result */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Prediction Result</h3>
          <div className="flex flex-col items-center py-4">
            <div className="relative size-44">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                  stroke="url(#ringGrad)"
                  strokeDasharray={`${(prediction?.marks ?? 0) * 2.64} 264`}
                  initial={{ strokeDasharray: "0 264" }}
                  animate={{ strokeDasharray: `${(prediction?.marks ?? 0) * 2.64} 264` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.21 270)" />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 230)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold text-gradient">{prediction ? prediction.marks.toFixed(0) : "—"}</div>
                <div className="text-xs text-muted-foreground">Predicted Marks /100</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full mt-5 text-center">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs text-muted-foreground">Grade</div>
                <div className="text-lg font-bold">{prediction?.grade ?? "—"}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-lg font-bold">{prediction ? `${(prediction.confidence * 100).toFixed(0)}%` : "—"}</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Model Metrics */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Model Metrics</h3>
          {modelMetrics ? (
            <div className="space-y-3">
              {[
                { label: "Accuracy", value: modelMetrics.accuracy, suffix: "" },
                { label: "R² Score", value: modelMetrics.r2, suffix: "" },
                { label: "RMSE", value: modelMetrics.rmse, suffix: "", absolute: true },
                { label: "MAE", value: modelMetrics.mae, suffix: "", absolute: true },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                    {m.label[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="text-lg font-bold">{m.absolute ? m.value.toFixed(2) : m.value.toFixed(2)}</div>
                  </div>
                  <div className="w-16">
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-full rounded-full btn-gradient" style={{ width: `${Math.min(100, m.absolute ? 100 - m.value : m.value * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Train a model to see metrics.</p>}
        </GlassCard>
      </div>

      {/* Model comparison */}
      {modelComparison.length > 0 && (
        <GlassCard>
          <h3 className="font-semibold mb-3">Model Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2 px-3">Model</th><th className="text-right py-2 px-3">Accuracy</th><th className="text-right py-2 px-3">RMSE</th><th className="text-right py-2 px-3">R² Score</th></tr>
              </thead>
              <tbody>
                {modelComparison.map((m) => (
                  <tr key={m.name} className={`border-b border-border/40 ${m.active ? "bg-primary/10" : ""}`}>
                    <td className="py-2 px-3 font-medium">{m.name}</td>
                    <td className="text-right py-2 px-3">{m.accuracy.toFixed(2)}</td>
                    <td className="text-right py-2 px-3">{m.rmse.toFixed(2)}</td>
                    <td className="text-right py-2 px-3">{m.r2.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Actual vs Predicted */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Actual vs Predicted</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis type="number" dataKey="actual" name="Actual" stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <YAxis type="number" dataKey="predicted" name="Predicted" stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <Tooltip contentStyle={{ background: "oklch(0.23 0.04 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              <Scatter data={scatterData} fill="oklch(0.7 0.21 270)" />
              <Line data={ideal} dataKey="y" stroke="oklch(0.78 0.18 60)" strokeDasharray="4 4" dot={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Performance trend */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Performance Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="week" stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <YAxis stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <Tooltip contentStyle={{ background: "oklch(0.23 0.04 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" name="Average Marks" stroke="oklch(0.72 0.18 230)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="predicted" name="Predicted Marks" stroke="oklch(0.7 0.21 270)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Feature importance */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Feature Importance</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fiData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis type="number" stroke="oklch(0.68 0.03 260)" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="oklch(0.68 0.03 260)" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: "oklch(0.23 0.04 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              <Bar dataKey="value" fill="oklch(0.7 0.21 270)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Grade distribution */}
        <GlassCard>
          <h3 className="font-semibold mb-3">Grade Distribution</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={gradeBuckets} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {gradeBuckets.map((g) => <Cell key={g.name} fill={g.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.23 0.04 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 text-sm">
              {gradeBuckets.map((g) => (
                <div key={g.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: g.color }} /><span>{g.name}</span></div>
                  <span className="font-semibold">{g.pct}%</span>
                </div>
              ))}
              <div className="text-xs text-muted-foreground pt-2">{students.length} students</div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
