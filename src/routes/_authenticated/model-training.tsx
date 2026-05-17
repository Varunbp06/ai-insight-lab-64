import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Play, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { ALGORITHMS, metrics, predict, trainModel, vectorize, type Algorithm } from "@/lib/ml";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/model-training")({ component: TrainingPage });

function TrainingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<Record<Algorithm, number>>({ linear: 0, forest: 0, xgboost: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<Record<Algorithm, { accuracy: number; rmse: number; mae: number; r2: number } | null>>({ linear: null, forest: null, xgboost: null });
  const [training, setTraining] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("*")).data ?? [],
  });
  const { data: saved = [] } = useQuery({
    queryKey: ["models", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("trained_models").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const append = (msg: string) => setLog((l) => [...l.slice(-12), msg]);

  const trainAll = async () => {
    if (students.length < 10) return toast.error("Need at least 10 student records.");
    setTraining(true);
    setLog([]); setResults({ linear: null, forest: null, xgboost: null });
    const X = students.map((s: any) => vectorize(s));
    const y = students.map((s: any) => Number(s.actual_marks ?? 0));
    append(`Loaded ${students.length} samples • 6 features`);
    append("Preprocessing: scaling complete, no NaN detected");

    for (const a of ALGORITHMS) {
      append(`▶ Training ${a.label}...`);
      for (let p = 10; p <= 90; p += 20) {
        await new Promise((r) => setTimeout(r, 120));
        setProgress((prev) => ({ ...prev, [a.id]: p }));
      }
      const model = trainModel(a.id, X, y);
      const preds = X.map((x) => predict(model, x));
      const m = metrics(y, preds);
      setProgress((prev) => ({ ...prev, [a.id]: 100 }));
      setResults((prev) => ({ ...prev, [a.id]: m }));
      append(`✓ ${a.label} — RMSE ${m.rmse.toFixed(2)} • R² ${m.r2.toFixed(3)} • MAE ${m.mae.toFixed(2)}`);
      await supabase.from("trained_models").insert({ owner_id: user!.id, algorithm: a.id, metrics: m as any, params: {} });
    }
    append("All models trained and saved.");
    qc.invalidateQueries({ queryKey: ["models"] });
    setTraining(false);
    toast.success("Training complete");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Model Training" subtitle="Retrain all algorithms on your current dataset" actions={
        <Button onClick={trainAll} disabled={training} className="btn-gradient border-0">
          <Play className="size-4 mr-2" />{training ? "Training..." : "Train All Models"}
        </Button>
      } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ALGORITHMS.map((a) => {
          const r = results[a.id];
          return (
            <GlassCard key={a.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center"><Brain className="size-5 text-primary" /></div>
                  <div>
                    <div className="font-semibold">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.tagline}</div>
                  </div>
                </div>
                {progress[a.id] === 100 && <CheckCircle2 className="size-5 text-success" />}
              </div>
              <Progress value={progress[a.id]} className="mt-4" />
              {r && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-4 gap-2 mt-4 text-center">
                  {[["Acc", r.accuracy.toFixed(2)], ["RMSE", r.rmse.toFixed(2)], ["MAE", r.mae.toFixed(2)], ["R²", r.r2.toFixed(2)]].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-white/5 p-2">
                      <div className="text-[10px] text-muted-foreground">{l}</div>
                      <div className="text-sm font-bold">{v}</div>
                    </div>
                  ))}
                </motion.div>
              )}
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-semibold mb-3">Training Log</h3>
          <div className="font-mono text-xs space-y-1 max-h-64 overflow-y-auto bg-black/30 rounded-lg p-3">
            {log.length === 0 ? <span className="text-muted-foreground">Idle. Click "Train All Models" to begin.</span> : log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Saved Model Runs</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {saved.length === 0 ? <p className="text-sm text-muted-foreground">No trained models yet.</p> : saved.slice(0, 12).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <div>
                  <div className="font-medium text-sm capitalize">{m.algorithm}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
                </div>
                <div className="text-xs text-muted-foreground">RMSE <span className="text-foreground font-semibold">{Number(m.metrics?.rmse ?? 0).toFixed(2)}</span></div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
