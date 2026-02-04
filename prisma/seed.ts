/**
 * データベースシードスクリプト
 * 開発用の初期データを投入
 */

import { PrismaClient } from '@prisma/client';
import { encryptApiKey } from '../lib/utils/encryption';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// パスワードハッシュ化（簡易版 - 本番環境ではbcryptを使用）
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('🌱 データベースのシード開始...');

  // 既存データをクリア（開発環境のみ）
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 組織を作成
  const organization = await prisma.organization.create({
    data: {
      name: 'Demo Corporation',
      tokenMonthlyLimit: 10000000, // 10M tokens/month
      currentUsage: 0,
      // 注意: 実際のAPIキーは設定画面から後で追加
      encOpenaiKey: null,
      encAnthropicKey: null,
      encGoogleKey: null,
    },
  });

  console.log('✅ 組織作成:', organization.name);

  // オーナーユーザーを作成
  const owner = await prisma.user.create({
    data: {
      email: 'owner@demo.com',
      passwordHash: hashPassword('demo123'),
      role: 'OWNER',
      organizationId: organization.id,
    },
  });

  console.log('✅ オーナー作成:', owner.email);

  // メンバーユーザーを作成
  const member = await prisma.user.create({
    data: {
      email: 'member@demo.com',
      passwordHash: hashPassword('demo123'),
      role: 'MEMBER',
      organizationId: organization.id,
    },
  });

  console.log('✅ メンバー作成:', member.email);

  // サンプルスレッドを作成
  const thread = await prisma.thread.create({
    data: {
      title: 'はじめてのチャット',
      organizationId: organization.id,
      userId: owner.id,
      messages: {
        create: [
          {
            role: 'user',
            content: 'こんにちは！',
            modelId: 'gpt-4',
            tokensUsed: 5,
            costEstimate: 0.0001,
          },
          {
            role: 'assistant',
            content: 'こんにちは！sunsunへようこそ。どのようなお手伝いができますか？',
            modelId: 'gpt-4',
            tokensUsed: 25,
            costEstimate: 0.0005,
          },
        ],
      },
    },
  });

  console.log('✅ サンプルスレッド作成:', thread.title);

  console.log('\n🎉 シード完了！');
  console.log('\n📝 ログイン情報:');
  console.log('   オーナー: owner@demo.com / demo123');
  console.log('   メンバー: member@demo.com / demo123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ シードエラー:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
