/**
 * アシスタントCRUD API
 * GET  /api/assistants - 一覧取得
 * POST /api/assistants - 新規作成
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
    const assistants = await prisma.assistant.findMany({
      where: {
        organizationId: decoded.organizationId,
        ...(decoded.role !== 'OWNER' ? { visibility: 'all', isActive: true } : {}),
      },
      include: {
        creator: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assistants });
  } catch (error) {
    console.error('Get assistants error:', error);
    return NextResponse.json({ error: 'アシスタント一覧の取得に失敗しました' }, { status: 500 });
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
    const { name, description, iconEmoji, iconColor, systemPrompt, modelId, conversationStarters, visibility } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'アシスタント名は必須です' }, { status: 400 });
    }
    if (!systemPrompt || !systemPrompt.trim()) {
      return NextResponse.json({ error: 'システムプロンプトは必須です' }, { status: 400 });
    }

    const assistant = await prisma.assistant.create({
      data: {
        organizationId: decoded.organizationId,
        name: name.trim(),
        description: description?.trim() || '',
        iconEmoji: iconEmoji || '🤖',
        iconColor: iconColor || 'indigo',
        systemPrompt: systemPrompt.trim(),
        modelId: modelId || null,
        conversationStarters: JSON.stringify(conversationStarters || []),
        visibility: visibility || 'all',
        createdBy: decoded.userId,
      },
      include: {
        creator: { select: { email: true } },
      },
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'assistant_create',
      metadata: { assistantId: assistant.id, name: assistant.name },
      request,
    });

    return NextResponse.json({ assistant }, { status: 201 });
  } catch (error) {
    console.error('Create assistant error:', error);
    return NextResponse.json({ error: 'アシスタントの作成に失敗しました' }, { status: 500 });
  }
}
