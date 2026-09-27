import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type Pump = {
  id: string;
  name: string;
  location: string;
  availability: 'HIGH' | 'MEDIUM' | 'LOW';
  queue: number;
  distance: string;
};

export default function PumpStatusList({ pumps }: { pumps: Pump[] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Pump Status</h2>
      <p className="mt-1 text-sm text-slate-500">Showing {pumps.length} pumps.</p>
      <div className="mt-4 grid gap-3">
        {pumps.map((pump) => (
          <div
            key={pump.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{pump.name}</p>
              <p className="text-sm text-slate-500">
                {pump.location} - {pump.distance}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-600">Queue: {pump.queue}</p>
              <Badge
                tone={
                  pump.availability === 'HIGH'
                    ? 'green'
                    : pump.availability === 'MEDIUM'
                      ? 'yellow'
                      : 'red'
                }
              >
                {pump.availability}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
