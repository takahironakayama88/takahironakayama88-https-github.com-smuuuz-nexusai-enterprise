/**
 * 監査ログ記録ユーティリティ
 * API routeから呼び出して操作ログを記録する
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest } from 'next/server';

export type AuditAction =
  | 'login'
  | 'api_key_change'
  | 'mode_change'
  | 'thread_create'
  | 'thread_delete';

interface RecordAuditParams {
  organizationId: string;
  userId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
}

function getClientIp(request?: NextRequest): string | null {
  if (!request) return null;
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

/**
 * 監査ログを記録する（fire-and-forget）
 * 記録失敗時もエラーを投げない
 */
export async function recordAudit({
  organizationId,
  userId,
  action,
  metadata = {},
  request,
}: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        metadata: JSON.stringify(metadata),
        ipAddress: getClientIp(request),
      },
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}
