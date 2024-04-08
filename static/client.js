// @ts-check

/// <reference lib="dom" />

// @deno-types="https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.d.ts"
import van from 'https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.js'

/**
 * @async
 * @param {string} owner
 * @param {string} repo
 * @param {string} number
 * @param {string} pat
 * @returns {Promise<any[]>}
 */
async function getPRConversations(owner, repo, number, pat) {
  let page = 1
  const allConversations = []

  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments?page=${page}`,
      {
        headers: { Authorization: `token ${pat}` },
      },
    )
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      allConversations.push(...data)
      page++
    } else {
      break
    }
  }

  return allConversations
}

const { a, button, div, h1, h3, input, label, li, ul } = van.tags

/**
 * @param {TemplateStringsArray} v
 * @returns {string}
 */
const css = (v) => v.toString().slice(1, -1)

const username = van.state(JSON.parse(localStorage.username || 'null'))
van.derive(() => localStorage.username = JSON.stringify(username.val))

const pat = van.state(JSON.parse(localStorage.pat || 'null'))
van.derive(() => localStorage.pat = JSON.stringify(pat.val))

const [_1, owner, repo, _2, number] = location.pathname.split('/')

/**
 * @type {Array<any>}
 */
const conversations = []
let page = 1
const error = van.state('')

outer: {
  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100&page=${page}`,
      pat
        ? {
          headers: { Authorization: `Bearer ${pat.val}` },
        }
        : {},
    )
    if (!response.ok) {
      switch (response.status) {
        case 401:
          error.val = 'Unauthorised, set Personal Access Token'
          break outer
        default:
          error.val = 'Error ' + response.statusText
          break outer
      }
    }
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      conversations.push(...data)
      page++
    } else {
      break
    }
  }
}

van.add(
  // @ts-ignore: executed on client
  document.body,
  h1(`${repo} PR #${number}`),
  div({ style: css`{color: red}` }, error),
  h3('Unresolved conversations'),
  () => ul(
    conversations
      .filter((c) => !username.val || c.user.login.includes(username.val))
      .filter((c) => c.position !== null)
      .map((c) => li(a({ href: c.html_url }, c.body))),
  ),
  // h3('Configuration'),
  div(
    { style: css`{display: grid; grid-template-columns: 1fr 1fr}` },
    label(
      'Show only comments by',
      input({
        type: 'text',
        placeholder: 'undefined',
        value: username.val,
        oninput: ({ target }) => username.val = target.value,
      }),
    ),
    label(
      'Github Personal Access Token',
      input({
        type: 'password',
        placeholder: 'undefined',
        value: pat.val,
        onchange: ({ target }) => pat.val = target.value,
      }),
    ),
  ),
  button({ onclick: () => location.reload() }, 'Reload'),
)
