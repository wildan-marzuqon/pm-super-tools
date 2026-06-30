import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const capabilities = await prisma.capability.findMany({
      orderBy: { id: 'asc' }
    });

    return NextResponse.json(capabilities);
  } catch (error: any) {
    console.error('Error fetching capabilities:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
