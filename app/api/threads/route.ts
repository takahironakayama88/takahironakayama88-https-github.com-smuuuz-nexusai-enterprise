/**
 * スレッド管理APIエンドポイント
 * GET /api/threads - スレッド一覧取得
 * POST /api/threads - 新規スレッド作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as jwt from 'jsonwebtoken';
import { recordAudit } from '@/lib/utils/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

interface JWTPayload {
  userId: string;
  organizationId: string;
}

function verifyAuth(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// スレッド一覧取得
export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const threads = await prisma.thread.findMany({
      where: {
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1, // 最初のメッセージのみ（タイトル生成用）
        },
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error('Get threads error:', error);
    return NextResponse.json(
      { error: 'スレッド取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 新規スレッド作成
export async function POST(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title } = body as { title?: string };

    const thread = await prisma.thread.create({
      data: {
        title: title || 'New Chat',
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'thread_create',
      metadata: { threadId: thread.id, title: thread.title },
      request,
    });

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Create thread error:', error);
    return NextResponse.json(
      { error: 'スレッド作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
