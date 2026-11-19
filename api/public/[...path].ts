import type { Request, Response } from 'express';
import handler from '../index';

export default async function publicHandler(request: Request, response: Response) {
  request.url = request.url.replace(/^\/api\/public/, '/public');
  return handler(request, response);
}
