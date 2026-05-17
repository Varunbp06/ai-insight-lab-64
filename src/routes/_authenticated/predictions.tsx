import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Loader2, Trash2, Lightbulb, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { FEATURE_NAMES, FEATURE_LABELS, gradeFor, type FeatureVector } from "@/lib/ml";
import { FEATURE_INPUT_RANGES } from "@/lib/seed";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/predictions")({ component: PredictionsPage });

// Each feature contributes a 0–100 sub-score based on how favourable it is.
// Weights sum to 1.0 so the final result is naturally bounded.
const WEIGHTS: Record<string, number> = {
  study_hours: 0.20,
  attendance: 0.20,
  sleep_hours: 0.10,
  previous_marks: 0.15,
  assignment_pct: 0.15,
  mock_test: 0.20,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function subScore(name: string, v: number): number {
  switch (name) {
    case "study_hours":
      // Optimal around 6h/day. Diminishing returns past 8h, harsh penalty past 10h.
      if (v <= 0) return 0;
      if (v <= 6) return clamp((v / 6) * 90);
      if (v <= 8) return clamp(90 + (v - 6) * 5);
      return clamp(100 - (v - 8) * 8);
    case "sleep_hours":
      // Peak at 7h. Both too little and too much hurt.
      return clamp(100 - Math.abs(7 - v) * 14);
    case "attendance":
    case "previous_marks":
    case "assignment_pct":
    case "mock_test":
      return clamp(v); // already on a 0–100 scale
    default:
      return 0;
  }
}

function computePrediction(inputs: FeatureVector): { marks: number; confidence: number } {
  let total = 0;
  let weightSum = 0;
  for (const k of FEATURE_NAMES) {
    const s = subScore(k, Number(inputs[k]) || 0);
    total += s * WEIGHTS[k];
    weightSum += WEIGHTS[k];
  }
  const marks = clamp(total / weightSum);
  // Confidence: higher when inputs are within typical ranges.
  const inRange = FEATURE_NAMES.filter((k) => {
    const r = FEATURE_INPUT_RANGES[k];
    return inputs[k] >= r.min && inputs[k] <= r.max;
  }).length;
  const confidence = 0.65 + (inRange / FEATURE_NAMES.length) * 0.3;
  return { marks: +marks.toFixed(1), confidence: +confidence.toFixed(2) };
}

function tipFor(inputs: FeatureVector): string {
  // Find the weakest sub-score and coach that.
  const scored = FEATURE_NAMES.map((k) => ({ k, s: subScore(k, inputs[k]) }))
    .sort((a, b) => a.s - b.s);
  const worst = scored[0];
  if (worst.s >= 75) return "Solid inputs across the board. Keep the routine steady and review weak topics weekly.";
  const tips: Record<string, string> = {
    attendance: "Attendance is the biggest lever — aim for 85%+ to see a clear lift.",
    study_hours: "Try adding 1–2 focused study hours per day. Consistency beats long cramming sessions.",
    sleep_hours: "Sleep around 7 hours. Both too little and too much hurt recall and focus.",
    assignment_pct: "Closing assignment gaps is low-effort, high-reward — they compound into the final grade.",
    mock_test: "Mock tests predict the real thing — practice one full paper this week under timed conditions.",
    previous_marks: "Past marks weigh in, but momentum matters more. A strong next test resets the trend.",
  };
  return tips[worst.k];
}

const gradeColor = (g: string) =>
  g === "A+" || g === "A" ? "text-success bg-success/15"
    : g === "B+" || g === "B" ? "text-primary bg-primary/15"
      : g === "C" ? "text-accent bg-accent/15"
        : "text-destructive bg-destructive/15";

function PredictionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inputs, setInputs] = useState<FeatureVector>(() => {
    const o = {} as FeatureVector;
    FEATURE_NAMES.forEach((k) => (o[k] = FEATURE_INPUT_RANGES[k].default));
    return o;
  });
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ marks: number; grade: string; confidence: number } | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["predictions", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("predictions").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const onPredict = async () => {
    setLoading(true);
    const { marks, confidence } = computePrediction(inputs);
    const grade = gradeFor(marks);
    await supabase.from("predictions").insert({
      owner_id: user!.id, model: "weighted", inputs: inputs as any,
      predicted_marks: marks, confidence, grade,
    });
    qc.invalidateQueries({ queryKey: ["predictions"] });
    setLastResult({ marks, grade, confidence });
    setLoading(false);
    toast.success(`Predicted ${marks.toFixed(1)} / 100 — Grade ${grade}`);
  };

  const onDelete = async (id: string) => {
    await supabase.from("predictions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["predictions"] });
    toast.success("Prediction removed");
  };

  const onReset = () => {
    const o = {} as FeatureVector;
    FEATURE_NAMES.forEach((k) => (o[k] = FEATURE_INPUT_RANGES[k].default));
    setInputs(o);
    setLastResult(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictions"
        subtitle="Estimate a student's likely marks from their habits and history."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="mb-1">
            <h3 className="font-semibold">Try a what-if scenario</h3>
            <p className="text-xs text-muted-foreground">
              Adjust the sliders to see how each habit moves the predicted score.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {FEATURE_NAMES.map((f) => {
              const r = FEATURE_INPUT_RANGES[f];
              return (
                <div key={f}>
                  <Label className="text-xs flex justify-between mb-2">
                    <span>{FEATURE_LABELS[f]}</span>
                    <span className="text-muted-foreground">{inputs[f]}{r.unit ? ` ${r.unit}` : ""}</span>
                  </Label>
                  <Slider min={r.min} max={r.max} step={r.step} value={[inputs[f]]} onValueChange={([v]) => setInputs({ ...inputs, [f]: v })} />
                  <Input type="number" min={r.min} max={r.max} step={r.step} value={inputs[f]} onChange={(e) => setInputs({ ...inputs, [f]: +e.target.value })} className="h-8 mt-2 text-xs" />
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={onPredict} disabled={loading} className="flex-1 btn-gradient border-0">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="size-4 mr-2" />Predict marks</>}
            </Button>
            <Button onClick={onReset} variant="outline" disabled={loading}>Reset</Button>
          </div>

          {lastResult && (
            <div className="mt-5 rounded-xl border border-border/50 p-4 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Predicted score</div>
                  <div className="text-4xl font-bold text-gradient leading-none mt-1">
                    {lastResult.marks.toFixed(1)}
                    <span className="text-base text-muted-foreground ml-1">/ 100</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-lg ${gradeColor(lastResult.grade)}`}>
                    Grade {lastResult.grade}
                  </span>
                  <div className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1 justify-end">
                    <TrendingUp className="size-3" /> {(lastResult.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="size-3.5 text-accent shrink-0 mt-0.5" />
                <span>{tipFor(inputs)}</span>
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent predictions</h3>
            <span className="text-[10px] text-muted-foreground">{history.length} saved</span>
          </div>
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 -mr-1">
            {history.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <Sparkles className="size-6 mx-auto mb-2 opacity-40" />
                Your predictions will appear here.
              </div>
            )}
            {history.map((p: any) => (
              <div key={p.id} className="rounded-lg p-3 bg-white/5 hover:bg-white/[0.07] transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold text-gradient leading-none">
                      {Number(p.predicted_marks).toFixed(0)}
                      <span className="text-[11px] text-muted-foreground ml-1 font-normal">/100</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${gradeColor(p.grade ?? "")}`}>
                      {p.grade}
                    </span>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete prediction"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
