import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Sparkles, Database, BarChart3, FileText, Settings, GraduationCap, LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predictions", label: "Predictions", icon: Sparkles },
  { to: "/dataset", label: "Dataset", icon: Database },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; role: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 glass border-r border-border/50 flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-border/40">
        <div className="size-10 rounded-xl btn-gradient flex items-center justify-center glow-primary">
          <GraduationCap className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-foreground truncate">{profile?.full_name ?? user?.email?.split("@")[0] ?? "Student"}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {profile?.role ?? "Performance Analytics"}
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map((n) => {
          const active = path === n.to;
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "text-foreground btn-gradient glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <Icon className="size-4" />
              <span className="font-medium">{n.label}</span>
              {active && <span className="absolute right-2 size-1.5 rounded-full bg-white/90" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/40">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold">
            {(profile?.full_name ?? user?.email ?? "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user?.email}</div>
            <div className="text-[10px] text-success flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse" /> Online
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="size-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
