const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: { issues?: Array<{ itemKey: string; sectionKey: string; message: string }> }) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = sessionStorage.getItem('jianjian.access');
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(error?.code ?? 'REQUEST_FAILED', error?.message ?? '网络请求失败，请重试。', response.status, error?.details);
  }
  return body as T;
}

export async function login(email: string, password: string) {
  const result = await api<{ accessToken: string; refreshToken: string }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  sessionStorage.setItem('jianjian.access', result.accessToken);
  sessionStorage.setItem('jianjian.refresh', result.refreshToken);
  return result;
}

export function clearSession() {
  sessionStorage.removeItem('jianjian.access');
  sessionStorage.removeItem('jianjian.refresh');
}

export function hasSession() {
  return Boolean(sessionStorage.getItem('jianjian.access'));
}

export async function compressPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法处理照片。');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('照片压缩失败。')), 'image/jpeg', 0.76));
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}
