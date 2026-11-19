import 'reflect-metadata';
import serverless from 'serverless-http';
import type { Request, Response } from 'express';
import { createNestApp } from '../apps/api/src/app.setup';

let serverHandler: ((request: Request, response: Response) => Promise<unknown>) | undefined;

async function getHandler() {
  if (!serverHandler) {
    const app = await createNestApp();
    await app.init();
    serverHandler = serverless(app.getHttpAdapter().getInstance()) as (request: Request, response: Response) => Promise<unknown>;
  }
  return serverHandler;
}

export default async function handler(request: Request, response: Response) {
  const handle = await getHandler();
  return handle(request, response);
}
