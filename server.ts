import nhttp, { Router } from 'nhttp/mod.ts'
import { serveDirWithTs } from 'https://deno.land/x/ts_serve@v1.4.4/mod.ts'

import index from './ssr/index.ts'

const kv = await Deno.openKv()

const getExclusions = async (pat: string) =>
  (await kv.get<string[]>([pat])).value ?? []

nhttp()
  .use(
    '/exclusions/:pat',
    new Router()
      .get('/', async ({ params }) => await getExclusions(params.pat))
      .post('/', async ({ body, params, response }) => {
        await kv.set(
          [params.pat],
          Array.from(
            new Set((await getExclusions(params.pat)).concat(body as string[])),
          ),
        )
        return response.sendStatus(204)
      })
      .delete('/', async ({ params, response }) => {
        await kv.delete([params.pat])
        return response.sendStatus(204)
      }),
  )
  .use('/csr', ({ request }) => serveDirWithTs(request))
  .get('*', ({ response }) => response.html(index))
  .listen(8000)
