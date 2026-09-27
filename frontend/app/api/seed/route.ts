import { NextResponse } from 'next/server';
import { seedPumpsAndSlots } from '@/lib/seed';

export async function GET() {
  try {
    await seedPumpsAndSlots();
    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
