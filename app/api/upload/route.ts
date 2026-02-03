/**
 * ファイルアップロードAPIエンドポイント
 * POST /api/upload
 * ファイルをBase64エンコードして返す（マルチモーダルAI用）
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';

// 最大ファイルサイズ (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// サポートする画像形式
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// サポートするドキュメント形式
const SUPPORTED_DOC_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export async function POST(request: NextRequest) {
  try {
    // 認証確認
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    // FormDataを取得
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'ファイルが選択されていません' }, { status: 400 });
    }

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        // ファイルサイズチェック
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`ファイル "${file.name}" が大きすぎます（最大10MB）`);
        }

        const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
        const isDocument = SUPPORTED_DOC_TYPES.includes(file.type);

        if (!isImage && !isDocument) {
          throw new Error(`ファイル "${file.name}" の形式はサポートされていません`);
        }

        // ファイルをArrayBufferとして読み込み
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        return {
          name: file.name,
          type: file.type,
          size: file.size,
          isImage,
          base64Data: `data:${file.type};base64,${base64}`,
        };
      })
    );

    return NextResponse.json({
      success: true,
      files: processedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'ファイルアップロード中にエラーが発生しました';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
