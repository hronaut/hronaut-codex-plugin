// Copies the Hronaut skill and license from the newest hronaut/hronaut release into the plugin and, when either
// changed, bumps the plugin's patch version and adds a changelog entry. Fails when the app no longer matches what the
// headers helper assumes. Writes `changed`, `tag` and `version` to $GITHUB_OUTPUT when it is set.
import { appendFile, readFile, writeFile } from 'node:fs/promises'

const APP = 'hronaut/hronaut'
const PLUGIN = 'plugins/hronaut'
const MANIFEST = `${PLUGIN}/.codex-plugin/plugin.json`
const token = process.env.GITHUB_TOKEN

async function get(url) {
  // The token only lifts the API's rate limit; hronaut/hronaut is public.
  const authorization = token && url.startsWith('https://api.github.com/') ? { Authorization: `Bearer ${token}` } : {}
  const response = await fetch(url, { headers: { 'User-Agent': 'hronaut-codex-plugin-sync', ...authorization } })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.text()
}

const tag = JSON.parse(await get(`https://api.github.com/repos/${APP}/releases/latest`)).tag_name
if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Unexpected release tag ${tag}`)
const file = (path) => get(`https://raw.githubusercontent.com/${APP}/${tag}/${path}`)

// The helper and tests hard-code these; a change in the app needs a change here first.
const assumptions = [
  ['src/main/mcp-token-store.ts', (text) => text.includes('const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/'), 'tokens match /^[A-Za-z0-9_-]{32,}$/'],
  ['src/shared/mcp-port.ts', (text) => text.includes('export const DEFAULT_MCP_PORT = 47_812'), 'the default MCP port is 47812'],
  ['package.json', (text) => JSON.parse(text).name === 'hronaut', 'the package name, and so the profile folder, is hronaut']
]
const broken = []
for (const [path, holds, assumption] of assumptions) {
  if (!holds(await file(path))) broken.push(`${path} in ${APP} ${tag}: the headers helper assumes ${assumption}.`)
}
if (broken.length > 0) {
  console.error(`${broken.join('\n')}\nUpdate the headers helper and tests to match, then run this workflow again.`)
  process.exit(1)
}

// Codex installs only the plugin's folder, so the plugin has its own copy of the license; the repository's is the same.
const copies = [
  ['skills/hronaut/SKILL.md', [`${PLUGIN}/skills/hronaut/SKILL.md`], 'the Hronaut skill'],
  ['LICENSE', [`${PLUGIN}/LICENSE`, 'LICENSE'], 'the license']
]
const updated = []
for (const [source, targets, name] of copies) {
  const text = await file(source)
  let changed = false
  for (const target of targets) {
    if ((await readFile(target, 'utf8')) !== text) {
      await writeFile(target, text)
      changed = true
    }
  }
  if (changed) updated.push(name)
}

let next
if (updated.length > 0) {
  const manifest = await readFile(MANIFEST, 'utf8')
  const version = JSON.parse(manifest).version
  const [major, minor, patch] = version.split('.').map(Number)
  next = `${major}.${minor}.${patch + 1}`
  await writeFile(MANIFEST, manifest.replace(`"version": "${version}"`, `"version": "${next}"`))
  const changelog = await readFile('CHANGELOG.md', 'utf8')
  const entry = `## ${next} - ${new Date().toISOString().slice(0, 10)}\n\n- Updates ${updated.join(' and ')} to Hronaut ${tag.slice(1)}.\n\n`
  const at = changelog.indexOf('\n## ') + 1
  await writeFile('CHANGELOG.md', at > 0 ? changelog.slice(0, at) + entry + changelog.slice(at) : `${changelog.trimEnd()}\n\n${entry}`)
}

console.log(next ? `Updated ${updated.join(' and ')} from ${tag} as version ${next}.` : `Up to date with ${tag}.`)
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `changed=${next !== undefined}\ntag=${tag}\nversion=${next ?? ''}\n`)
}
