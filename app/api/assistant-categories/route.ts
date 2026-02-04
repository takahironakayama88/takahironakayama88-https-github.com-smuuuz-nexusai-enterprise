/**
 * アシスタントカテゴリAPI
 * GET  /api/assistant-categories - カテゴリ一覧取得
 * POST /api/assistant-categories - カテゴリ作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';
import { recordAudit } from '@/lib/utils/audit';

export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const categories = await prisma.assistantCategory.findMany({
      where: {
        organizationId: decoded.organizationId,
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { assistants: true } },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'カテゴリ一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'カテゴリ名は必須です' }, { status: 400 });
    }

    // 同一組織内で重複チェック
    const existing = await prisma.assistantCategory.findUnique({
      where: {
        organizationId_name: {
          organizationId: decoded.organizationId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: '同名のカテゴリが既に存在します' }, { status: 409 });
    }

    // displayOrder: 既存の最大値 + 1
    const maxOrder = await prisma.assistantCategory.aggregate({
      where: { organizationId: decoded.organizationId },
      _max: { displayOrder: true },
    });

    const category = await prisma.assistantCategory.create({
      data: {
        organizationId: decoded.organizationId,
        name: name.trim(),
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
      include: {
        _count: { select: { assistants: true } },
      },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'category_create',
      metadata: { categoryId: category.id, name: category.name },
      request,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'カテゴリの作成に失敗しました' }, { status: 500 });
  }
}
