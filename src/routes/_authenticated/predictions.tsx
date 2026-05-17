import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Sparkles, Loader2, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  ALGORITHMS, FEATURE_NAMES, FEATURE_LABELS, gradeFor, metrics, predict,
  trainModel, vectorize, type Algorithm, type FeatureVector,
} from "@/lib/ml";
import { FEATURE_INPUT_RANGES } from "@/lib/seed";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/predictions")({ component: PredictionsPage });

function PredictionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [algo, setAlgo] = useState<Algorithm>("xgboost");
  const [inputs, setInputs] = useState<FeatureVector>(() => {
    const o = {} as FeatureVector;
    FEATURE_NAMES.forEach((k) => (o[k] = FEATURE_INPUT_RANGES[k].default));
    return o;
  });
  const [loading, setLoading] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("*")).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["predictions", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("predictions").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const model = useMemo(() => {
    if (students.length < 5) return null;
    const X = students.map((s: any) => vectorize(s));
    const y = students.map((s: any) => Number(s.actual_marks ?? 0));
    return { trained: trainModel(algo, X, y), m: metrics(y, X.map((x) => predict(trainModel(algo, X, y), x))) };
  }, [students, algo]);

  const onPredict = async () => {
    if (!model) return toast.error("Not enough data — upload a dataset first.");
    setLoading(true);
    const marks = predict(model.trained, vectorize(inputs));
    const confidence = Math.max(0.5, Math.min(0.99, model.m.r2));
    await supabase.from("predictions").insert({ model: algo, inputs, predicted_marks: marks, confidence, grade: gradeFor(marks) });
    qc.invalidateQueries({ queryKey: ["predictions"] });
    setLoading(false);
    toast.success(`Predicted ${marks.toFixed(1)}/100 — Grade ${gradeFor(marks)}`);
  };

  const onDelete = async (id: string) => {
    await supabase.from("predictions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["predictions"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Predictions" subtitle="Generate marks predictions and review your history" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">New Prediction</h3>
            <Select value={algo} onValueChange={(v) => setAlgo(v as Algorithm)}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{ALGORITHMS.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
          <Button onClick={onPredict} disabled={loading} className="w-full btn-gradient border-0 mt-6">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="size-4 mr-2" />Run Prediction</>}
          </Button>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Recent Predictions</h3>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {history.length === 0 && <p className="text-xs text-muted-foreground">No predictions yet.</p>}
            {history.map((p: any) => (
              <div key={p.id} className="rounded-lg p-3 bg-white/5 group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold text-gradient">{Number(p.predicted_marks).toFixed(0)}<span className="text-xs text-muted-foreground ml-1">/100</span></div>
                    <div className="text-[11px] text-muted-foreground">{p.model} • {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary">{p.grade}</span>
                    <button onClick={() => onDelete(p.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
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
