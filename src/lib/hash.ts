// 비밀번호는 그대로 보내지 않고, 되돌릴 수 없는 값(SHA-256)으로 바꿔서 보냄
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, '');

export const adminKeyHash = (key: string) => sha256(`portal-admin:${key.trim()}`);
export const teacherKeyHash = (classId: string, password: string) => sha256(`portal:${classId}:teacher:${password}`);
export const resetCodeHash = (classId: string, code: string) => sha256(`portal:${classId}:reset:${normalizeCode(code)}`);
export const pinHash = (classId: string, sid: string, pin: string) => sha256(`portal:${classId}:${sid}:${pin}`);

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 코드용 글자
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function randomCode(length: number): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join('');
}

// TV 주소용 긴 비밀 값
export function randomToken(): string {
  const values = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(values, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

export const randomId = () => Date.now().toString(36) + randomCode(4).toLowerCase();
