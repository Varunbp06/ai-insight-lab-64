import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { LogOut, Sun, Moon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [institution, setInstitution] = useState("");
  const [notif, setNotif] = useState(true);
  const [light, setLight] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setFullName(data.full_name ?? ""); setRole(data.role ?? ""); setInstitution(data.institution ?? ""); }
    });
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
  }, [light]);

  const save = async () => {
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, email: user!.email, full_name: fullName, role, institution, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Account, appearance, and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <h3 className="font-semibold mb-4">Profile</h3>
          <div className="space-y-4">
            <div><Label className="text-xs">Email</Label><Input value={user?.email ?? ""} disabled className="mt-1" /></div>
            <div><Label className="text-xs">Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Role</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Teacher / Analyst" className="mt-1" /></div>
              <div><Label className="text-xs">Institution</Label><Input value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1" /></div>
            </div>
            <Button onClick={save} className="btn-gradient border-0 w-full">Save changes</Button>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-4">Appearance & Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-3">
                {light ? <Sun className="size-4 text-warning" /> : <Moon className="size-4 text-primary" />}
                <div>
                  <div className="text-sm font-medium">Theme</div>
                  <div className="text-xs text-muted-foreground">{light ? "Light mode" : "Dark mode"}</div>
                </div>
              </div>
              <PreferenceToggle checked={light} onCheckedChange={setLight} label="Toggle theme" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div>
                <div className="text-sm font-medium">Email notifications</div>
                <div className="text-xs text-muted-foreground">Weekly performance digests</div>
              </div>
              <PreferenceToggle checked={notif} onCheckedChange={setNotif} label="Toggle email notifications" />
            </div>
            <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="w-full text-destructive">
              <LogOut className="size-4 mr-2" />Sign out
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function PreferenceToggle({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}
