/**
 * 個別スレッドAPIエンドポイント
 * GET /api/threads/[id] - スレッド詳細とメッセージ取得
 * PATCH /api/threads/[id] - スレッド更新
 * DELETE /api/threads/[id] - スレッド削除
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const thread = await prisma.thread.findFirst({
      where: {
        id,
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Get thread error:', error);
    return NextResponse.json(
      { error: 'スレッド取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'タイトルが必要です' }, { status: 400 });
    }

    // スレッドの所有権を確認
    const thread = await prisma.thread.findFirst({
      where: {
        id,
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    }

    // スレッド更新
    const updatedThread = await prisma.thread.update({
      where: { id },
      data: {
        title,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ thread: updatedThread });
  } catch (error) {
    console.error('Update thread error:', error);
    return NextResponse.json(
      { error: 'スレッド更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // スレッドの所有権を確認
    const thread = await prisma.thread.findFirst({
      where: {
        id,
        userId: decoded.userId,
        organizationId: decoded.organizationId,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    }

    // スレッドを削除（メッセージも cascade で削除される）
    await prisma.thread.delete({
      where: { id },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'thread_delete',
      metadata: { threadId: id, title: thread.title },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete thread error:', error);
    return NextResponse.json(
      { error: 'スレッド削除中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
