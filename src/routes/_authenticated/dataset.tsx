import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload, Download, Search, Trash2, Wand2, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { gradeFor } from "@/lib/ml";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dataset")({ component: DatasetPage });

const PAGE_SIZE = 12;

function DatasetPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("*").order("student_code")).data ?? [],
  });

  const filtered = useMemo(
    () => students.filter((s: any) => `${s.name} ${s.student_code}`.toLowerCase().includes(q.toLowerCase())),
    [students, q],
  );
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).map((r, i) => ({
          owner_id: user!.id,
          student_code: String(r.student_code ?? r.id ?? r.ID ?? 9000 + i),
          name: String(r.name ?? r.Name ?? `Student ${i + 1}`),
          study_hours: +(r.study_hours ?? r["Study Hours"] ?? 0) || 0,
          attendance: +(r.attendance ?? r["Attendance"] ?? 0) || 0,
          sleep_hours: +(r.sleep_hours ?? r["Sleep Hours"] ?? 0) || 0,
          previous_marks: +(r.previous_marks ?? r["Previous Marks"] ?? 0) || 0,
          assignment_pct: +(r.assignment_pct ?? r["Assignment"] ?? 0) || 0,
          mock_test: +(r.mock_test ?? r["Mock Test"] ?? 0) || 0,
          actual_marks: r.actual_marks ? +r.actual_marks : null,
        }));
        const { error } = await supabase.from("students").insert(rows);
        setImporting(false);
        if (error) return toast.error(error.message);
        toast.success(`Imported ${rows.length} rows`);
        qc.invalidateQueries({ queryKey: ["students"] });
      },
      error: (err) => { setImporting(false); toast.error(err.message); },
    });
  };

  const onExport = () => {
    const csv = Papa.unparse(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "students.csv";
    a.click();
  };

  const onClean = async () => {
    // Treat 0 or null in feature columns as missing → impute with column mean
    const cols = ["study_hours", "attendance", "sleep_hours", "previous_marks", "assignment_pct", "mock_test"] as const;
    const means: Record<string, number> = {};
    cols.forEach((c) => {
      const vals = students.map((s: any) => Number(s[c])).filter((v) => v > 0);
      means[c] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    let fixed = 0;
    for (const s of students as any[]) {
      const patch: any = {};
      cols.forEach((c) => { if (!s[c] || s[c] <= 0) { patch[c] = +means[c].toFixed(2); fixed++; } });
      if (!s.actual_marks) { patch.actual_marks = +means.previous_marks.toFixed(0); patch.grade = gradeFor(patch.actual_marks); }
      if (Object.keys(patch).length) await supabase.from("students").update(patch).eq("id", s.id);
    }
    toast.success(`Cleaned ${fixed} missing values`);
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const onDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dataset"
        subtitle={`${students.length} student records`}
        actions={
          <>
            <label>
              <input type="file" accept=".csv" className="hidden" onChange={onUpload} />
              <Button asChild variant="outline"><span>{importing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Upload className="size-4 mr-2" />}Upload CSV</span></Button>
            </label>
            <Button variant="outline" onClick={onClean}><Wand2 className="size-4 mr-2" />Clean</Button>
            <Button onClick={onExport} className="btn-gradient border-0"><Download className="size-4 mr-2" />Export</Button>
          </>
        }
      />

      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search by name or ID..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} results</div>
        </div>
        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    {["ID", "Name", "Study", "Attendance", "Sleep", "Prev Marks", "Assignment", "Mock", "Actual", "Grade", ""].map((h) => (
                      <th key={h} className="text-left py-3 px-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-white/3 group">
                      <td className="py-2.5 px-3 font-mono text-xs">{s.student_code}</td>
                      <td className="py-2.5 px-3 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3">{Number(s.study_hours).toFixed(1)}</td>
                      <td className="py-2.5 px-3">{s.attendance}%</td>
                      <td className="py-2.5 px-3">{Number(s.sleep_hours).toFixed(1)}</td>
                      <td className="py-2.5 px-3">{s.previous_marks}</td>
                      <td className="py-2.5 px-3">{s.assignment_pct}%</td>
                      <td className="py-2.5 px-3">{s.mock_test}</td>
                      <td className="py-2.5 px-3 font-semibold">{s.actual_marks ?? "—"}</td>
                      <td className="py-2.5 px-3"><span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary">{s.actual_marks ? gradeFor(Number(s.actual_marks)) : "—"}</span></td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => onDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4 text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>Next</Button>
              </div>
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
