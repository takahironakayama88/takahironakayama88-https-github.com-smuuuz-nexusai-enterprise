/**
 * アシスタントカテゴリ個別API
 * PUT    /api/assistant-categories/[id] - カテゴリ更新
 * DELETE /api/assistant-categories/[id] - カテゴリ削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';
import { recordAudit } from '@/lib/utils/audit';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.assistantCategory.findFirst({
      where: { id, organizationId: decoded.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'カテゴリが見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const { name, displayOrder } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'カテゴリ名は必須です' }, { status: 400 });
      }

      // 名前変更時に重複チェック
      if (name.trim() !== existing.name) {
        const duplicate = await prisma.assistantCategory.findUnique({
          where: {
            organizationId_name: {
              organizationId: decoded.organizationId,
              name: name.trim(),
            },
          },
        });

        if (duplicate) {
          return NextResponse.json({ error: '同名のカテゴリが既に存在します' }, { status: 409 });
        }
      }

      updateData.name = name.trim();
    }

    if (displayOrder !== undefined) {
      updateData.displayOrder = displayOrder;
    }

    const category = await prisma.assistantCategory.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { assistants: true } },
      },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'category_update',
      metadata: { categoryId: category.id, name: category.name },
      request,
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'カテゴリの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  if (decoded.role !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER権限が必要です' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.assistantCategory.findFirst({
      where: { id, organizationId: decoded.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'カテゴリが見つかりません' }, { status: 404 });
    }

    // カテゴリ削除（所属アシスタントはonDelete: SetNullで自動的に未分類へ）
    await prisma.assistantCategory.delete({ where: { id } });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'category_delete',
      metadata: { categoryId: id, name: existing.name },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'カテゴリの削除に失敗しました' }, { status: 500 });
  }
}
