/**
 * 利用可能なモデル一覧取得エンドポイント
 * GET /api/models
 *
 * APIキーが設定されているプロバイダーのモデルのみを返す
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

export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    // 組織のAPIキー設定状態を取得
    const organization = await prisma.organization.findUnique({
      where: { id: decoded.organizationId },
      select: {
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

    // プロバイダー名のマッピング（表示用）
    const providerDisplayNames: Record<string, string> = {
      openai: 'ChatGPT',
      anthropic: 'Claude',
      google: 'Gemini',
    };

    // 利用可能なモデルをフィルタリング
    const availableModels = Object.entries(AI_MODELS)
      .filter(([_, config]) => configuredProviders.includes(config.provider))
      .map(([modelId, config]) => ({
        id: modelId,
        name: config.displayName,
        provider: providerDisplayNames[config.provider] || config.provider,
      }));

    return NextResponse.json({
      models: availableModels,
      configuredProviders: configuredProviders.map(p => providerDisplayNames[p] || p),
    });
  } catch (error) {
    console.error('Get available models error:', error);
    return NextResponse.json(
      { error: 'モデル一覧の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
