/// <reference types="astro/client" />
type D1Database = import('@cloudflare/workers-types').D1Database;
interface WorkerEnv {
  DB: D1Database;
  APP_URL: string;
  CRON_SECRET?: string;
  ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  NORDIGEN_SECRET_ID?: string;
  NORDIGEN_SECRET_KEY?: string;
}
type WorkerRuntime = import('@astrojs/cloudflare').Runtime<WorkerEnv>;
declare namespace App { interface Locals extends WorkerRuntime {} }
