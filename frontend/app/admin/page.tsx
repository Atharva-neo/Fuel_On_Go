'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPumps } from '@/services/api';

const PumpStatusList = dynamic(() => import('@/components/admin/PumpStatusList'), {
  loading: () => (
    <Card>
      <p className="text-sm text-slate-500">Loading pump status...</p>
    </Card>
  ),
});

type Pump = {
  id: string;
  name: string;
  location: string;
  availability: 'HIGH' | 'MEDIUM' | 'LOW';
  queue: number;
  distance: string;
};

type DashboardData = {
  pumps: Pump[];
  totalPumps: number;
  activePumps: number;
  avgWaitTime: number;
};

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </Card>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pumps = (await getPumps()) as Pump[];
      const safePumps = Array.isArray(pumps) ? pumps : [];
      const activePumps = safePumps.filter((pump) => pump.availability !== 'LOW').length;
      const avgQueue = safePumps.length
        ? safePumps.reduce((sum, pump) => sum + pump.queue, 0) / safePumps.length
        : 0;

      setData({
        pumps: safePumps,
        totalPumps: safePumps.length,
        activePumps,
        avgWaitTime: Math.round(avgQueue * 5),
      });
    } catch {
      setError('Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('fuel_on_go_admin_token');
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    loadDashboard();
  }, [loadDashboard, router]);

  const handleLogout = () => {
    localStorage.removeItem('fuel_on_go_admin_token');
    router.push('/admin/login');
  };

  return (
    <main className="page-shell">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Lightweight operations snapshot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboard}>
            Refresh
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {loading ? (
        <LoadingDashboard />
      ) : error ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-base font-semibold text-slate-800">{error}</p>
          <Button onClick={loadDashboard}>Retry</Button>
        </Card>
      ) : data ? (
        <div className="grid gap-4">
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Total pumps"
              value={data.totalPumps}
              subtitle="Configured in current environment"
            />
            <StatCard
              label="Active pumps"
              value={data.activePumps}
              subtitle="Pumps with medium or high availability"
            />
            <StatCard
              label="Avg wait time"
              value={`${data.avgWaitTime} min`}
              subtitle="Estimated from queue counts"
            />
          </section>
          <PumpStatusList pumps={data.pumps.slice(0, 20)} />
        </div>
      ) : null}
    </main>
  );
}
