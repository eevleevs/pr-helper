import nhttp, { Router } from 'nhttp/mod.ts'
import { serveStatic } from 'nhttp/lib/serve-static.ts'
import index from './views/index.ts'

const kv = await Deno.openKv()

const getExclusions = async (pat: string) =>
  (await kv.get<string[]>([pat])).value ?? []

nhttp()
  .use(
    '/exclusions/:pat',
    new Router()
      .get('/', async ({ params }) => await getExclusions(params.pat))
      .post('/', async ({ body, params, response }) => {
        const data = body as Array<string>
        await kv.set(
          [params.pat],
          Array.from(new Set((await getExclusions(params.pat)).concat(data))),
        )
        return response.sendStatus(204)
      })
      .delete('/', async ({ params, response }) => {
        await kv.delete([params.pat])
        return response.sendStatus(204)
      }),
  )
  .use(serveStatic('static', { prefix: '/static' }))
  .get('*', ({ response }) => response.html(index))
  .listen(8000)
