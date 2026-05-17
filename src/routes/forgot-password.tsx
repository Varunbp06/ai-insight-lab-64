import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Check your inbox.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold">Reset password</h2>
        <p className="text-sm text-muted-foreground mt-1">We'll email you a link to set a new one.</p>
        {sent ? (
          <p className="mt-6 text-sm text-success">Email sent. Check your inbox.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full btn-gradient border-0">Send reset link</Button>
          </form>
        )}
        <p className="mt-5 text-sm text-center text-muted-foreground">
          <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
