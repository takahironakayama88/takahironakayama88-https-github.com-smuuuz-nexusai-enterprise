/**
 * 監査データCSVエクスポートAPI
 * GET /api/audit/export?type=logs|chats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'logs') {
      const logs = await prisma.auditLog.findMany({
        where: { organizationId: decoded.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { user: { select: { email: true } } },
      });

      const header = 'Date,User,Action,Details,IP Address\n';
      const rows = logs.map(log =>
        [
          log.createdAt.toISOString(),
          escapeCsv(log.user.email),
          log.action,
          escapeCsv(log.metadata),
          log.ipAddress || '',
        ].join(',')
      ).join('\n');

      return new Response('\uFEFF' + header + rows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (type === 'chats') {
      const messages = await prisma.message.findMany({
        where: {
          thread: { organizationId: decoded.organizationId },
        },
        orderBy: { createdAt: 'asc' },
        take: 10000,
        include: {
          thread: {
            select: { title: true, user: { select: { email: true } } },
          },
        },
      });

      const header = 'Date,Thread,User,Role,Model,Content,Tokens\n';
      const rows = messages.map(msg =>
        [
          msg.createdAt.toISOString(),
          escapeCsv(msg.thread.title),
          escapeCsv(msg.thread.user.email),
          msg.role,
          msg.modelId,
          escapeCsv(msg.content.substring(0, 500)),
          msg.tokensUsed.toString(),
        ].join(',')
      ).join('\n');

      return new Response('\uFEFF' + header + rows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="chat_history_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'typeは"logs"または"chats"を指定してください' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 });
  }
}
