import { transpile } from 'https://deno.land/x/emit@0.38.3/mod.ts'
import { Hono } from 'hono/mod.ts'
import { serveStatic } from 'hono/middleware.ts'

const index = /* html */ `
  <!DOCTYPE html>
  ${
  Deno.env.get('DENO_DEPLOYMENT_ID')
    ? ''
    : '<script src="http://localhost:35729/livereload.js?snipver=1"></script>'
}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
  <style>
    input {width: 15em}
  </style>
  <script src="/client.js", type="module"></script>
`

const app = new Hono()
  .use(serveStatic({ root: 'static' }))
  .get('*', (c) => c.html(index))

Deno.serve(app.fetch)
