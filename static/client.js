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

/**
 * Calculates the SHA-256 hash of the given plain text.
 * @param {string} plain - The plain text to calculate the hash for.
 * @returns {Promise<string>} A promise that resolves to the SHA-256 hash as a hexadecimal string.
 */
function sha256(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hashBuffer = crypto.subtle.digest('SHA-256', data)
  return hashBuffer.then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  })
}


/**
 * @param {TemplateStringsArray} v
 * @returns {string}
*/
const css = (v) => v.toString().slice(1, -1)

const username = van.state(JSON.parse(localStorage.username || 'null'))
van.derive(() => localStorage.username = JSON.stringify(username.val))

const pat = van.state(JSON.parse(localStorage.pat || 'null'))
let hashedPat = ''
van.derive(async () => {
  localStorage.pat = JSON.stringify(pat.val)
  hashedPat = await sha256(pat.val)
})

const [_1, owner, repo, _2, number] = location.pathname.split('/')
const error = van.state('')

/**
 * Fetches conversation threads from a GitHub pull request.
*
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {number} number - The number of the pull request.
 * @param {string} pat - The personal access token for authentication.
 * @param {string|null} [after=null] - The cursor for pagination.
 * @returns {Promise<Array<{id: string, isResolved: boolean, body: string, href: string, author: string}>>} - A promise that resolves to an array of conversation threads.
 * @throws {Error} When the fetch operation fails.
 */
async function fetchConversations(owner, repo, number, pat, after = null) {
  error.val = ''
  const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        pullRequest(number: ${number}) {
          reviewThreads(first: 100, after: ${after ? `"${after}"` : null}) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              id
              isResolved
              comments(first: 1) {
                nodes {
                  body
                  url
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  let response
  try {
    response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `bearer ${pat}`,
      },
      body: JSON.stringify({ query }),
    })
  } catch (error) {
    error.val = error.message
    return []
  }

  if (!response.ok) {
    error.val = response.statusText || `Error ${response.status}` + (response.status == 401 ? ': unauthorised; set Personal Access Token' : '') + '.'
    return []
  }

  const data = await response.json()
  if (data.errors) {
    // @ts-ignore
    error.val = data.errors.map(({ message }) => message).join('<br>')
    return []
  }

  const threads = data.data.repository.pullRequest.reviewThreads
  // @ts-ignore
  const conversations = threads.nodes.map(({ id, isResolved, comments }) => ({
    id,
    isResolved,
    body: comments.nodes[0].body,
    href: comments.nodes[0].url,
    author: comments.nodes[0].author.login,
  }));

  if (threads.pageInfo.hasNextPage) {
    const nextPageConversations = await fetchConversations(owner, repo, number, pat, threads.pageInfo.endCursor);
    conversations.push(...nextPageConversations)
  }

  return conversations
}

const conversations = van.state(await fetchConversations(owner, repo, parseInt(number), pat.val))

const exclusions = await (await fetch(`/exclusions/${hashedPat}`)).json()
conversations.val = conversations.val.filter(({ id }) => !exclusions.includes(id))

const { a, button, div, h1, input, label, li, ul } = van.tags

van.add(
  document.body,
  h1(`${repo} PR #${number}`),
  div({ style: css`{color: red}` }, error),
  div({
    onmouseup: ({ button, srcElement }) => {
      if (button > 1) return
      conversations.val = conversations.val.filter(({ id }) => id !== srcElement.id)
      fetch(`/exclusions/${hashedPat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([srcElement.id]),
      })
    }
  },
    () => ul(
      conversations.val
        .filter(({ author }) => !username.val || author.includes(username.val))
        .filter(({ isResolved }) => !isResolved)
        .map(({ id, href, body }) => li(a({ id, href, target: '_blank' }, body))),
    )
  ),
  div(
    { style: css`{display: grid; grid-template-columns: 1fr 1fr 1fr}` },
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
        onchange: ({ target }) => {
          pat.val = target.value
          location.reload()
        },
      }),
    ),
    div({ style: css`{text-align: center}` },
      button({
        style: css`{margin-top: 1.35em;}`,
        onclick: async () => {
          await fetch(`/exclusions/${hashedPat}`, { method: 'DELETE' })
          location.reload()
        },
      }, 'Reset Exclusions')),
  ),
)