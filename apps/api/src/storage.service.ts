import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  private get driver() {
    return this.config.get<string>('STORAGE_DRIVER', 'local');
  }

  private localPath(key: string) {
    const root = resolve(this.config.get<string>('UPLOAD_DIR', './uploads'));
    const path = resolve(root, key);
    if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) throw new Error('Invalid object key');
    return path;
  }

  private supabaseHeaders(contentType?: string) {
    const key = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    };
  }

  private supabaseObjectUrl(key: string) {
    const base = this.config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    return `${base}/storage/v1/object/${bucket}/${key}`;
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    if (this.driver === 'supabase') {
      const response = await fetch(this.supabaseObjectUrl(key), {
        method: 'POST',
        headers: { ...this.supabaseHeaders(contentType), 'x-upsert': 'false' },
        body: new Uint8Array(body),
      });
      if (!response.ok) throw new Error(`对象存储写入失败（${response.status}）。`);
      return;
    }
    if (this.driver !== 'local') throw new Error('不支持的存储驱动。');
    const path = this.localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' });
  }

  async getObject(key: string): Promise<{ buffer: Buffer; mime: string }> {
    if (this.driver === 'supabase') {
      const response = await fetch(this.supabaseObjectUrl(key), { headers: this.supabaseHeaders() });
      if (response.status === 404) throw new NotFoundException('照片不存在。');
      if (!response.ok) throw new Error(`对象存储读取失败（${response.status}）。`);
      return { buffer: Buffer.from(await response.arrayBuffer()), mime: response.headers.get('content-type') ?? 'application/octet-stream' };
    }
    return { buffer: await readFile(this.localPath(key)), mime: 'application/octet-stream' };
  }
}
