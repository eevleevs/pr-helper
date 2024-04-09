export default /* html */ `
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
  <script src="/static/client.js" type="module"></script>
`
