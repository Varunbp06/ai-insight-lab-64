import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Download, Trash2 } from "lucide-react";
import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatDistanceToNow } from "date-fns";
import { gradeFor } from "@/lib/ml";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("students").select("*").order("student_code")).data ?? [],
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["reports", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("reports").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const summary = useMemo(() => {
    if (!students.length) return null;
    const marks = students.map((s: any) => Number(s.actual_marks ?? 0));
    return {
      total: students.length,
      avg: (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2),
      high: Math.max(...marks),
      low: Math.min(...marks),
      pass: marks.filter((m) => m >= 40).length,
    };
  }, [students]);

  const genPdf = async () => {
    if (!students.length) return toast.error("No data yet.");
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Edulytic — Student Performance Report", 14, 18);
    doc.setFontSize(10); doc.setTextColor(120); doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25);
    doc.setTextColor(0); doc.setFontSize(12);
    doc.text(`Total Students: ${summary?.total}`, 14, 38);
    doc.text(`Average Marks: ${summary?.avg}`, 14, 45);
    doc.text(`Highest: ${summary?.high}   Lowest: ${summary?.low}   Pass Rate: ${((summary?.pass ?? 0) / (summary?.total ?? 1) * 100).toFixed(1)}%`, 14, 52);
    autoTable(doc, {
      startY: 60,
      head: [["ID", "Name", "Study", "Att%", "Sleep", "Prev", "Asgmt%", "Mock", "Actual", "Grade"]],
      body: students.map((s: any) => [s.student_code, s.name, s.study_hours, s.attendance, s.sleep_hours, s.previous_marks, s.assignment_pct, s.mock_test, s.actual_marks ?? "—", s.actual_marks ? gradeFor(Number(s.actual_marks)) : "—"]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [120, 80, 220] },
    });
    doc.save("student-report.pdf");
    await supabase.from("reports").insert({ name: "Student Performance Report", type: "pdf", payload: summary ?? {} });
    qc.invalidateQueries({ queryKey: ["reports"] });
    toast.success("PDF generated");
  };

  const genExcel = async () => {
    if (!students.length) return toast.error("No data yet.");
    const ws = XLSX.utils.json_to_sheet(students);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student-report.xlsx");
    await supabase.from("reports").insert({ name: "Student Performance Spreadsheet", type: "excel", payload: summary ?? {} });
    qc.invalidateQueries({ queryKey: ["reports"] });
    toast.success("Excel generated");
  };

  const delReport = async (id: string) => {
    await supabase.from("reports").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Generate and download performance reports" actions={
        <>
          <Button variant="outline" onClick={genExcel}><Download className="size-4 mr-2" />Excel</Button>
          <Button onClick={genPdf} className="btn-gradient border-0"><FileText className="size-4 mr-2" />Generate PDF</Button>
        </>
      } />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[["Total","total"],["Average","avg"],["Highest","high"],["Lowest","low"],["Pass","pass"]].map(([l,k]) => (
            <GlassCard key={l} className="text-center">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="text-2xl font-bold text-gradient mt-1">{(summary as any)[k]}</div>
            </GlassCard>
          ))}
        </div>
      )}

      <GlassCard>
        <h3 className="font-semibold mb-3">Saved Reports</h3>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet. Generate one above.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 group">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-primary" />
                  <div>
                    <div className="font-medium text-sm">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.type.toUpperCase()} • {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
                <button onClick={() => delReport(r.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
