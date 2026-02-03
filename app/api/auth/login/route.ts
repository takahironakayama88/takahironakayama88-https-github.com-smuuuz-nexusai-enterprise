/**
 * ログインAPIエンドポイント
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// パスワードハッシュ化（簡易版 - シードスクリプトと同じ）
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// JWT署名用シークレット（環境変数から取得、なければデフォルト）
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d'; // 7日間有効

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // パスワード検証
    const hashedPassword = hashPassword(password);
    if (user.passwordHash !== hashedPassword) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // JWTトークン生成
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // レスポンス
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'ログイン処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
