/**
 * アシスタント個別API
 * GET    /api/assistants/[id] - 詳細取得
 * PUT    /api/assistants/[id] - 更新
 * DELETE /api/assistants/[id] - 削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/utils/auth';
import { recordAudit } from '@/lib/utils/audit';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const assistant = await prisma.assistant.findFirst({
      where: {
        id,
        organizationId: decoded.organizationId,
      },
      include: {
        creator: { select: { email: true } },
      },
    });

    if (!assistant) {
      return NextResponse.json({ error: 'アシスタントが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ assistant });
  } catch (error) {
    console.error('Get assistant error:', error);
    return NextResponse.json({ error: 'アシスタントの取得に失敗しました' }, { status: 500 });
  }
}

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
    const existing = await prisma.assistant.findFirst({
      where: { id, organizationId: decoded.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'アシスタントが見つかりません' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, iconEmoji, iconColor, systemPrompt, modelId, conversationStarters, visibility, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (iconEmoji !== undefined) updateData.iconEmoji = iconEmoji;
    if (iconColor !== undefined) updateData.iconColor = iconColor;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt.trim();
    if (modelId !== undefined) updateData.modelId = modelId || null;
    if (conversationStarters !== undefined) updateData.conversationStarters = JSON.stringify(conversationStarters);
    if (visibility !== undefined) updateData.visibility = visibility;
    if (isActive !== undefined) updateData.isActive = isActive;

    const assistant = await prisma.assistant.update({
      where: { id },
      data: updateData,
      include: {
        creator: { select: { email: true } },
      },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'assistant_update',
      metadata: { assistantId: assistant.id, name: assistant.name },
      request,
    });

    return NextResponse.json({ assistant });
  } catch (error) {
    console.error('Update assistant error:', error);
    return NextResponse.json({ error: 'アシスタントの更新に失敗しました' }, { status: 500 });
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
    const existing = await prisma.assistant.findFirst({
      where: { id, organizationId: decoded.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'アシスタントが見つかりません' }, { status: 404 });
    }

    await prisma.assistant.delete({ where: { id } });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'assistant_delete',
      metadata: { assistantId: id, name: existing.name },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assistant error:', error);
    return NextResponse.json({ error: 'アシスタントの削除に失敗しました' }, { status: 500 });
  }
}
