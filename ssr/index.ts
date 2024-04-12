import van from 'https://deno.land/x/minivan@0.5.3/src/van-plate.js'

const { link, script, style } = van.tags
const css = (v: TemplateStringsArray) => v

export default van.html(
  Deno.env.get('DENO_DEPLOYMENT_ID')
    ? ''
    : script({ src: 'http://localhost:35729/livereload.js?snipver=1' }),
  link({
    rel: 'stylesheet',
    href: 'https://cdn.jsdelivr.net/npm/water.css@2/out/water.css',
  }),
  style(css`
    #conversations a, #conversations a:visited {
      color: inherit;
    }
    a > code {
      color: var(--code);
    }
  `),
  script({ src: '/csr/index.ts', type: 'module' }),
)
