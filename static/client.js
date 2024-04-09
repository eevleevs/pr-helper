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

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${pat}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) return []

  const data = await response.json();
  const threads = data.data.repository.pullRequest.reviewThreads;
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
    conversations.push(...nextPageConversations);
  }

  return conversations;
}

const conversations = van.state(await fetchConversations(owner, repo, parseInt(number), pat.val))

van.add(
  // @ts-ignore: executed on client
  document.body,
  h1(`${repo} PR #${number}`),
  div({
    onmouseup: ({ button, srcElement }) => {
      if (button > 1) return
      conversations.val = conversations.val.filter(({ id }) => id !== srcElement.id)
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