/**
 * AIモード設定エンドポイント
 * GET /api/settings/modes - モード設定を取得
 * PUT /api/settings/modes - モード設定を更新
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as jwt from 'jsonwebtoken';
import { AI_MODELS, type ModelId } from '@/lib/ai/providers';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

interface JWTPayload {
  userId: string;
  organizationId: string;
  role: string;
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

// モード定義
export const AI_MODES = {
  fast: { id: 'fast', name: '高速モード', description: '素早い応答', icon: '⚡' },
  balanced: { id: 'balanced', name: 'バランスモード', description: '速度と品質のバランス', icon: '⚖️' },
  precision: { id: 'precision', name: '高精度モード', description: '複雑なタスク向け', icon: '🎯' },
} as const;

export type ModeId = keyof typeof AI_MODES;

// モード設定を取得
export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: decoded.organizationId },
      select: {
        fastModeModel: true,
        balancedModeModel: true,
        precisionModeModel: true,
        encOpenaiKey: true,
        encAnthropicKey: true,
        encGoogleKey: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 });
    }

    // 設定されているプロバイダーを特定
    const configuredProviders: string[] = [];
    if (organization.encOpenaiKey) configuredProviders.push('openai');
    if (organization.encAnthropicKey) configuredProviders.push('anthropic');
    if (organization.encGoogleKey) configuredProviders.push('google');

    // 利用可能なモデル一覧
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, config]) => configuredProviders.includes(config.provider))
      .map(([modelId, config]) => ({
        id: modelId,
        name: config.displayName,
        provider: config.provider,
      }));

    // 設定されているモードのみ返す
    const configuredModes: Array<{
      id: ModeId;
      name: string;
      description: string;
      icon: string;
      modelId: string | null;
      modelName: string | null;
    }> = [];

    const modeConfigs = {
      fast: organization.fastModeModel,
      balanced: organization.balancedModeModel,
      precision: organization.precisionModeModel,
    };

    for (const [modeId, modelId] of Object.entries(modeConfigs)) {
      if (modelId) {
        const mode = AI_MODES[modeId as ModeId];
        const modelConfig = AI_MODELS[modelId as ModelId];
        configuredModes.push({
          id: modeId as ModeId,
          name: mode.name,
          description: mode.description,
          icon: mode.icon,
          modelId,
          modelName: modelConfig?.displayName || modelId,
        });
      }
    }

    return NextResponse.json({
      modes: configuredModes,
      modeSettings: {
        fast: organization.fastModeModel,
        balanced: organization.balancedModeModel,
        precision: organization.precisionModeModel,
      },
      availableModels,
    });
  } catch (error) {
    console.error('Get mode settings error:', error);
    return NextResponse.json(
      { error: 'モード設定の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// モード設定を更新（OWNER権限が必要）
export async function PUT(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (decoded.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'モード設定にはOWNER権限が必要です' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { fast, balanced, precision } = body as {
      fast?: string | null;
      balanced?: string | null;
      precision?: string | null;
    };

    // 更新データを構築
    const updateData: {
      fastModeModel?: string | null;
      balancedModeModel?: string | null;
      precisionModeModel?: string | null;
    } = {};

    if (fast !== undefined) updateData.fastModeModel = fast || null;
    if (balanced !== undefined) updateData.balancedModeModel = balanced || null;
    if (precision !== undefined) updateData.precisionModeModel = precision || null;

    await prisma.organization.update({
      where: { id: decoded.organizationId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'モード設定を更新しました',
    });
  } catch (error) {
    console.error('Update mode settings error:', error);
    return NextResponse.json(
      { error: 'モード設定の更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
