import nhttp from 'nhttp/mod.ts'
import { serveDirWithTs } from 'https://deno.land/x/ts_serve@v1.4.4/mod.ts'
import { exclusionsRouter } from './exclusions.ts'
import index from './ssr/index.ts'

nhttp()
  .use('/exclusions', exclusionsRouter)
  .use('/csr', ({ request }) => serveDirWithTs(request))
  .get('*', ({ response }) => response.html(index))
  .listen(8000)
