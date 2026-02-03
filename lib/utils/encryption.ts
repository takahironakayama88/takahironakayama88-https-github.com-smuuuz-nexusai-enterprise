/**
 * AES-256-GCM暗号化ユーティリティ
 * APIキーの暗号化・復号化を行う
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// 暗号化アルゴリズム
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * マスターキーから固定長の鍵を生成
 */
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // マスターキーを32バイトに正規化
  return Buffer.from(masterKey.padEnd(KEY_LENGTH, '0').slice(0, KEY_LENGTH));
}

/**
 * APIキーを暗号化
 * @param plaintext - 暗号化する平文（APIキー）
 * @returns 暗号化されたデータ（IV + AuthTag + Ciphertext）をBase64エンコードした文字列
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // IV + AuthTag + Ciphertext を連結してBase64エンコード
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
  return combined.toString('base64');
}

/**
 * APIキーを復号化
 * @param ciphertext - Base64エンコードされた暗号文
 * @returns 復号化された平文（APIキー）
 */
export function decryptApiKey(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Ciphertext cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(ciphertext, 'base64');

    // IV, AuthTag, Encrypted Dataを分離
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Failed to decrypt API key: Invalid ciphertext or key');
  }
}

/**
 * 暗号化されたAPIキーが有効かチェック
 */
export function isValidEncryptedKey(ciphertext: string): boolean {
  try {
    decryptApiKey(ciphertext);
    return true;
  } catch {
    return false;
  }
}
