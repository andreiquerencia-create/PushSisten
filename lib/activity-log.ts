import { prisma } from '@/lib/db';

export async function logActivity(data: {
  action: string;
  description: string;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  userId?: string;
  userName?: string;
  metadata?: any;
}) {
  try {
    await prisma.activityLog.create({ data });
  } catch (e) {
    console.error('Activity log error:', e);
  }
}
