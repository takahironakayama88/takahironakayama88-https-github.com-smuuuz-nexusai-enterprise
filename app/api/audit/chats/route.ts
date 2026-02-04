/**
 * チャット監査API
 * GET /api/audit/chats - 組織全体のチャット履歴（OWNER専用）
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

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const userId = searchParams.get('userId');
  const keyword = searchParams.get('keyword');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const skip = (page - 1) * limit;

  const threadWhere: Record<string, unknown> = { organizationId: decoded.organizationId };
  if (userId) threadWhere.userId = userId;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to + 'T23:59:59.999Z');
    threadWhere.createdAt = createdAt;
  }

  try {
    // キーワード検索: メッセージ内容にマッチするスレッドIDを取得
    if (keyword) {
      const matchingThreadIds = await prisma.message.findMany({
        where: {
          content: { contains: keyword },
          thread: { organizationId: decoded.organizationId },
        },
        select: { threadId: true },
        distinct: ['threadId'],
      });
      threadWhere.id = { in: matchingThreadIds.map(m => m.threadId) };
    }

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where: threadWhere,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { email: true, role: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.thread.count({ where: threadWhere }),
    ]);

    return NextResponse.json({
      threads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Chat audit error:', error);
    return NextResponse.json({ error: 'チャット監査データの取得に失敗しました' }, { status: 500 });
  }
}
