/**
 * JWT認証ヘルパー
 * API routeで共通利用する認証検証ユーティリティ
 */

import { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

/**
 * リクエストからJWTトークンを検証してペイロードを返す
 * 認証失敗時はnullを返す
 */
export function verifyAuth(request: NextRequest): JWTPayload | null {
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
