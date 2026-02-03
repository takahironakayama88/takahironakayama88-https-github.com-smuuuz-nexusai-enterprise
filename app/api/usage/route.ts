/**
 * 使用量取得APIエンドポイント
 * GET /api/usage
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function GET(request: NextRequest) {
  try {
    // 認証確認
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('認証が必要です', { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: JWTPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return new Response('無効な認証トークンです', { status: 401 });
    }

    // 組織情報を取得
    const organization = await prisma.organization.findUnique({
      where: { id: decoded.organizationId },
      select: {
        currentUsage: true,
        tokenMonthlyLimit: true,
      },
    });

    if (!organization) {
      return new Response('組織が見つかりません', { status: 404 });
    }

    return Response.json({
      currentUsage: organization.currentUsage,
      monthlyLimit: organization.tokenMonthlyLimit,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return new Response('使用量取得中にエラーが発生しました', { status: 500 });
  }
}
