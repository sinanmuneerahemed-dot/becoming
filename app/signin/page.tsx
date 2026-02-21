"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";

export default function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push("/app");
    } catch (err: unknown) {
      let message = "Sign-in failed. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("popup-closed")) {
          message = "Sign-in was cancelled.";
        } else if (err.message.includes("popup-blocked")) {
          message = "Popup was blocked. Please allow popups and try again.";
        } else if (err.message.includes("auth/")) {
          message = "Authentication error. Please try again or use a different account.";
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <GlassCard className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center space-y-6">
          <img src="/logo.png" alt="Becoming" className="h-14 mx-auto" />
          <h1 className="text-2xl font-bold tracking-wider">BECOMING</h1>
          <p className="text-white/70 text-sm">
            Sign in to start your daily check-in
          </p>
          <NeonButton
            onClick={handleSignIn}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Signing in..." : "Continue with Google"}
          </NeonButton>
          {error && (
            <p className="text-red-400 text-sm" role="alert">
              {error}
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
