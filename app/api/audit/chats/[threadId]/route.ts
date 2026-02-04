/**
 * チャット監査 スレッド詳細API
 * GET /api/audit/chats/[threadId] - 特定スレッドの全メッセージ（OWNER専用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  const { threadId } = await params;

  try {
    const thread = await prisma.thread.findFirst({
      where: {
        id: threadId,
        organizationId: decoded.organizationId,
      },
      include: {
        user: { select: { email: true, role: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Chat audit detail error:', error);
    return NextResponse.json({ error: 'スレッド詳細の取得に失敗しました' }, { status: 500 });
  }
}
