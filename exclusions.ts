import { Router } from 'nhttp/mod.ts'

const kv = await Deno.openKv()

export type Exclusions = string[]

const getExclusions = async (pat: string) =>
  (await kv.get<Exclusions>([pat])).value ?? []

export const exclusionsRouter = new Router({ base: '/:pat' })
  .get(
    '/',
    async ({ params }): Promise<Exclusions> => await getExclusions(params.pat),
  )
  .post('/', async ({ body, params, response }) => {
    await kv.set(
      [params.pat],
      Array.from(
        new Set(
          (await getExclusions(params.pat)).concat(
            body as Exclusions,
          ),
        ),
      ),
    )
    return response.sendStatus(204)
  })
  .delete('/', async ({ params, response }) => {
    await kv.delete([params.pat])
    return response.sendStatus(204)
  })
