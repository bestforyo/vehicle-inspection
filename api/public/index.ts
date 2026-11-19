import type { Request, Response } from 'express';
import handler from '../index';

export default async function publicHandler(request: Request, response: Response) {
  const originalPath = request.headers['x-vercel-original-path'] ?? request.headers['x-vercel-original-url'];
  request.url = typeof originalPath === 'string' ? originalPath : request.url.replace(/^\/api\/public/, '/public');
  return handler(request, response);
}
