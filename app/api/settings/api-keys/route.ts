/**
 * APIキー設定エンドポイント
 * PUT /api/settings/api-keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { encryptApiKey } from '@/lib/utils/encryption';
import * as jwt from 'jsonwebtoken';
import { recordAudit } from '@/lib/utils/audit';

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

export async function PUT(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  // OWNER権限チェック
  if (decoded.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'APIキーの設定にはOWNER権限が必要です' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { provider, apiKey } = body as { provider: 'openai' | 'anthropic' | 'google'; apiKey: string };

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'providerとapiKeyは必須です' },
        { status: 400 }
      );
    }

    // APIキーを暗号化
    const encryptedKey = encryptApiKey(apiKey);

    // データベースを更新
    const updateData: any = {};
    switch (provider) {
      case 'openai':
        updateData.encOpenaiKey = encryptedKey;
        break;
      case 'anthropic':
        updateData.encAnthropicKey = encryptedKey;
        break;
      case 'google':
        updateData.encGoogleKey = encryptedKey;
        break;
      default:
        return NextResponse.json(
          { error: 'サポートされていないプロバイダーです' },
          { status: 400 }
        );
    }

    await prisma.organization.update({
      where: { id: decoded.organizationId },
      data: updateData,
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'api_key_change',
      metadata: { provider },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `${provider}のAPIキーを設定しました`,
    });
  } catch (error) {
    console.error('API key setting error:', error);
    const errorMessage = error instanceof Error ? error.message : 'APIキー設定中にエラーが発生しました';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// APIキーを解除
export async function DELETE(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  if (decoded.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'APIキーの解除にはOWNER権限が必要です' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as 'openai' | 'anthropic' | 'google' | null;

    if (!provider || !['openai', 'anthropic', 'google'].includes(provider)) {
      return NextResponse.json(
        { error: '有効なproviderを指定してください' },
        { status: 400 }
      );
    }

    const updateData: Record<string, null> = {};
    switch (provider) {
      case 'openai':
        updateData.encOpenaiKey = null;
        break;
      case 'anthropic':
        updateData.encAnthropicKey = null;
        break;
      case 'google':
        updateData.encGoogleKey = null;
        break;
    }

    await prisma.organization.update({
      where: { id: decoded.organizationId },
      data: updateData,
    });

    await recordAudit({
      organizationId: decoded.organizationId,
      userId: decoded.userId,
      action: 'api_key_change',
      metadata: { provider, operation: 'disconnect' },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `${provider}のAPIキーを解除しました`,
    });
  } catch (error) {
    console.error('API key disconnect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'APIキー解除中にエラーが発生しました';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// APIキーの状態を取得
export async function GET(request: NextRequest) {
  const decoded = verifyAuth(request);
  if (!decoded) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
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

    return NextResponse.json({
      openai: !!organization.encOpenaiKey,
      anthropic: !!organization.encAnthropicKey,
      google: !!organization.encGoogleKey,
    });
  } catch (error) {
    console.error('Get API key status error:', error);
    return NextResponse.json(
      { error: 'APIキー状態の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
