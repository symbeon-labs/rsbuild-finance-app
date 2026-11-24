/**
 * RSBUILD OS · ERP Credentials Crypto & Masking (server-only)
 *
 * Criptografia simétrica autenticada (AES-256-GCM) para segredos de API (Omie app_secret)
 * armazenados por organização no Supabase.
 *
 * A chave de criptografia é derivada de:
 *   1. process.env.ERP_CREDENTIALS_ENCRYPTION_KEY (recomendado em produção)
 *   2. process.env.SUPABASE_SECRET_KEY (fallback server-only já presente no ambiente)
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CIPHER_ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function resolveMasterKey(overrideSecret?: string): Buffer {
  const secret =
    overrideSecret ??
    process.env.ERP_CREDENTIALS_ENCRYPTION_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "Chave mestra de criptografia ausente no servidor (ERP_CREDENTIALS_ENCRYPTION_KEY ou SUPABASE_SECRET_KEY)."
    );
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Criptografa um segredo em texto plano usando AES-256-GCM.
 * Formato retornado: `enc:v1:<iv_hex>:<tag_hex>:<cipher_hex>`
 */
export function encryptSecret(plainText: string, overrideSecret?: string): string {
  const key = resolveMasterKey(overrideSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Descriptografa um segredo gerado por `encryptSecret`.
 * Lança erro caso o formato seja inválido ou a tag de autenticação falhe (tampering).
 */
export function decryptSecret(cipherText: string, overrideSecret?: string): string {
  if (!cipherText.startsWith(PREFIX)) {
    throw new Error("Formato de credencial criptografada inválido.");
  }
  const rest = cipherText.slice(PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 3) {
    throw new Error("Estrutura de credencial criptografada corrompida.");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");

  const key = resolveMasterKey(overrideSecret);
  const decipher = createDecipheriv(CIPHER_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Mascara uma App Key para exibição segura na interface sem vazar o segredo completo.
 */
export function maskKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 6) return "••••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}
