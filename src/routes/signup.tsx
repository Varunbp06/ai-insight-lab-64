import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, User, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { generateSeedStudents } from "@/lib/seed";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

async function seedNewUser(userId: string) {
  const seed = generateSeedStudents(60).map((s) => ({ ...s, owner_id: userId }));
  await supabase.from("students").insert(seed);
}

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    if (error) { setLoading(false); return toast.error(error.message); }
    if (data.user) await seedNewUser(data.user.id);
    setLoading(false);
    toast.success("Account created — welcome!");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error(result.error.message);
    if (!result.redirected) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await seedNewUser(data.user.id);
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-11 rounded-xl btn-gradient flex items-center justify-center glow-primary">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Create account</h2>
            <p className="text-xs text-muted-foreground">Start predicting in under a minute.</p>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
          <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.6 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.05.78 3.75 1.45l2.55-2.45C16.6 4.1 14.55 3.2 12 3.2 6.92 3.2 2.8 7.32 2.8 12.4S6.92 21.6 12 21.6c6.93 0 9.5-4.85 9.5-9.4 0-.6-.07-1.05-.15-1.1z"/></svg>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px bg-border flex-1" />OR<div className="h-px bg-border flex-1" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="pl-9" placeholder="Alex Morgan" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="At least 8 characters" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full btn-gradient border-0">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-sm text-center text-muted-foreground">
          Already have an account? <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
