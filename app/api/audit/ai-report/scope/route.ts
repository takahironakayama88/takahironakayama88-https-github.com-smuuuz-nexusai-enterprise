/**
 * AI監査レポート スコープ確認API
 * GET /api/audit/ai-report/scope
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';

export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const userId = searchParams.get('userId');

    if (!from || !to) {
      return NextResponse.json({ error: '日付範囲を指定してください' }, { status: 400 });
    }

    const dateFrom = new Date(from);
    const dateTo = new Date(to + 'T23:59:59.999Z');

    const threadWhere: Record<string, unknown> = {
      organizationId: decoded.organizationId,
      createdAt: { gte: dateFrom, lte: dateTo },
    };
    if (userId) {
      threadWhere.userId = userId;
    }

    const [threadCount, threads] = await Promise.all([
      prisma.thread.count({ where: threadWhere }),
      prisma.thread.findMany({
        where: threadWhere,
        select: { id: true, userId: true },
      }),
    ]);

    const threadIds = threads.map(t => t.id);
    const uniqueUserIds = new Set(threads.map(t => t.userId));

    const messageCount = threadIds.length > 0
      ? await prisma.message.count({ where: { threadId: { in: threadIds } } })
      : 0;

    return NextResponse.json({
      threadCount,
      messageCount,
      userCount: uniqueUserIds.size,
    });
  } catch (error) {
    console.error('AI report scope error:', error);
    return NextResponse.json(
      { error: 'スコープの取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
