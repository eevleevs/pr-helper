/// <reference lib="dom" />

import type { Exclusions } from '../exclusions.ts'

// @deno-types="https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.d.ts"
import van from 'https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.5.0.min.js'

const { a, button, code, div, h1, h3, input, label, li, pre, ul } = van.tags

async function sha256(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

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

async function fetchConversations(
  owner: string,
  repo: string,
  number: number,
  pat: string,
  after: string | null = null,
): Promise<
  Array<
    {
      id: string
      isResolved: boolean
      body: string
      href: string
      author: string
    }
  >
> {
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
  `

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
    error.val = response.statusText ||
      `Error ${response.status}` + (response.status == 401
          ? ': unauthorised. Set a Personal Access Token with read permissions for discussion, user, repo'
          : '') +
        '.'
    return []
  }

  const data = await response.json()
  if (data.errors) {
    error.val = data.errors.map(
      ({ message }: { message: string[] }) => message,
    ).join('<br>')
    return []
  }

  const threads = data.data.repository.pullRequest.reviewThreads
  const conversations = threads.nodes.map((
    { id, isResolved, comments }: {
      id: string
      isResolved: boolean
      comments: {
        nodes: { author: { login: string }; body: string; url: string }[]
      }
    },
  ) => ({
    id,
    isResolved,
    body: comments.nodes[0].body
      .split(/```/g)
      .map((part, i) =>
        div(
          i % 2
            ? pre(code(
              part.trim()
                .replace(/^suggestion/, '')
                .replace(/^(\s*\n+)+/, ''),
            ))
            : part,
        )
      ),
    href: comments.nodes[0].url,
    author: comments.nodes[0].author.login,
  }))

  if (threads.pageInfo.hasNextPage) {
    conversations.push(
      ...await fetchConversations(
        owner,
        repo,
        number,
        pat,
        threads.pageInfo.endCursor,
      ),
    )
  }

  return conversations
}

const conversations = van.state(
  await fetchConversations(owner, repo, parseInt(number), pat.val),
)

const exclusions: Exclusions = await (await fetch(`/exclusions/${hashedPat}`))
  .json()
conversations.val = conversations.val.filter(({ id }) =>
  !exclusions.includes(id)
)

function excludeConversation(srcElement: HTMLElement) {
  conversations.val = conversations.val.filter(({ id }) => id !== srcElement.id)
  fetch(`/exclusions/${hashedPat}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([srcElement.id] as Exclusions),
  })
}

van.add(
  document.body,
  h1(
    `${repo} PR `,
    a({ href: `https://github.com${location.pathname}` }, `#${number}`),
  ),
  div({ style: 'color: red' }, error),
  div({
    id: 'conversations',
    onmouseup: ({ button, srcElement }) => {
      if (button <= 1) excludeConversation(srcElement.closest('li'))
    },
  }, () =>
    ul(
      conversations.val
        .filter(({ author }) => !username.val || author.includes(username.val))
        .filter(({ isResolved }) => !isResolved)
        .map(({ id, href, body }) =>
          li({ id }, a({ href, target: '_blank' }, body))
        ),
    )),
  button({ onclick: () => location.reload() }, 'Reload'),
  button({
    onclick: async () => {
      await fetch(`/exclusions/${hashedPat}`, { method: 'DELETE' })
      location.reload()
    },
  }, 'Reset'),
  button({
    onclick: () =>
      Array.from(
        document.querySelectorAll('#conversations a'),
        (a) => a as HTMLAnchorElement,
      )
        .filter((_, i) => i < 5)
        .forEach((element) => {
          window.open(element.href)
          excludeConversation(element)
        }),
  }, 'Open 5'),
  h3('Configuration'),
  div(
    { style: 'display: grid; grid-template-columns: 1fr 1fr 1fr' },
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
  ),
)
