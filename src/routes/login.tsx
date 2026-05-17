import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error(result.error.message);
    if (!result.redirected) navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl btn-gradient flex items-center justify-center glow-primary">
            <GraduationCap className="size-6" />
          </div>
          <span className="text-xl font-bold">Edulytic</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Predict performance.<br />
            <span className="text-gradient">Unlock potential.</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            A premium AI analytics platform that turns student data into actionable academic insights — backed by real machine learning models.
          </p>
        </motion.div>
        <div className="text-xs text-muted-foreground">© 2026 Edulytic. Built for educators who care.</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">Welcome back to your dashboard.</p>

          <Button type="button" variant="outline" className="w-full mt-6" onClick={onGoogle}>
            <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.05.78 3.75 1.45l2.55-2.45C16.6 4.1 14.55 3.2 12 3.2 6.92 3.2 2.8 7.32 2.8 12.4S6.92 21.6 12 21.6c6.93 0 9.5-4.85 9.5-9.4 0-.6-.07-1.05-.15-1.1z"/></svg>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px bg-border flex-1" />OR<div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-gradient border-0">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-sm text-center text-muted-foreground">
            No account? <Link to="/signup" className="text-accent hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
