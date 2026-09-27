"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/services/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await adminLogin({ username, password });
      localStorage.setItem("fuel_on_go_admin_token", response.token || "mock-admin-token");
      router.push("/admin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to login";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-center text-2xl font-bold text-slate-900">Admin Login</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Manage pumps, queues, and bookings.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Username</label>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin123"
            />
          </div>

          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="pt-2 text-center">
            <Button type="submit" disabled={loading} className="px-8">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
