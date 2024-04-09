import { Context, Hono } from 'hono/mod.ts'
import { serveStatic } from 'hono/middleware.ts'

import index from './views/index.ts'

const app = new Hono()
  .use(serveStatic({ root: 'static' }))
  .get((c: Context) => c.html(index))

Deno.serve(app.fetch)
