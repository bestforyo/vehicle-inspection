import Taro from '@tarojs/taro';

declare const API_BASE_URL: string;
const BASE = API_BASE_URL.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public code: string, message: string, public statusCode: number, public details?: { issues?: Array<{ itemKey: string; sectionKey: string; message: string }> }) { super(message); }
}

export async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', data?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = Taro.getStorageSync('jianjian.access');
  const response = await Taro.request({
    url: `${BASE}${path}`,
    method,
    data: data as Record<string, unknown>,
    header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    timeout: 20000,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = (response.data as { error?: { code?: string; message?: string; details?: ApiError['details'] } })?.error;
    throw new ApiError(error?.code ?? 'REQUEST_FAILED', error?.message ?? '网络请求失败，请检查连接后重试。', response.statusCode, error?.details);
  }
  return response.data as T;
}

export async function uploadPhoto(path: string, filePath: string, orderId: string, itemKey: string, onProgress?: (progress: number) => void) {
  const token = Taro.getStorageSync('jianjian.access');
  const task = Taro.uploadFile({
    url: `${BASE}${path}`,
    filePath,
    name: 'file',
    formData: { orderId, itemKey },
    header: { Authorization: `Bearer ${token}` },
  });
  task.onProgressUpdate((event) => onProgress?.(event.progress));
  const response = await task;
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const body = JSON.parse(response.data) as { error?: { message?: string } };
    throw new ApiError('UPLOAD_FAILED', body.error?.message ?? '照片上传失败，请重试。', response.statusCode);
  }
  return JSON.parse(response.data) as { id: string; status: string };
}

export function saveSession(accessToken: string, refreshToken: string) {
  Taro.setStorageSync('jianjian.access', accessToken);
  Taro.setStorageSync('jianjian.refresh', refreshToken);
}

export function clearSession() {
  Taro.removeStorageSync('jianjian.access');
  Taro.removeStorageSync('jianjian.refresh');
}

export function requireLogin() {
  if (!Taro.getStorageSync('jianjian.access')) {
    Taro.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  return true;
}

export function showError(cause: unknown) {
  Taro.showToast({ title: (cause as Error).message?.slice(0, 30) || '操作失败，请重试', icon: 'none', duration: 3000 });
}

export function apiBase() { return BASE; }
