import { type ChildProcess, execFile, spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const PLUGIN_ROOT = 'plugins/hronaut'
const STORE_DESCRIPTION = 'Give your coding agent its own browser. Keep yours. Connects your agent to Hronaut, a visible desktop browser for '
  + 'coding agents, with a separate workspace for each project. Requires the Hronaut app (10-day free trial at hronaut.dev).'
const TOKEN = 'a'.repeat(20) + '-_B9'.repeat(5)
/** Hronaut's default MCP port, DEFAULT_MCP_PORT in the app; the daily sync checks that it still is. */
const DEFAULT_MCP_PORT = 47_812
/** Electron names Hronaut's profile folder after the app's package name; the daily sync checks that it still is. */
const PROFILE_FOLDER = 'hronaut'
/** The variables Codex gives a headers helper on macOS and Linux (DEFAULT_ENV_VARS in its rmcp-client); it drops the rest. */
const CODEX_HELPER_VARIABLES = ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'USER', '__CF_USER_TEXT_ENCODING', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'TZ']
/** The same on Windows (WINDOWS_CORE_ENV_VARS in its protocol crate). */
const CODEX_WINDOWS_HELPER_VARIABLES = [
  'PATH', 'PATHEXT', 'SHELL', 'COMSPEC', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'USERNAME', 'USERDOMAIN', 'USERPROFILE', 'HOMEDRIVE',
  'HOMEPATH', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'PROGRAMDATA', 'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP', 'TMPDIR',
  'POWERSHELL', 'PWSH'
]

interface CodexManifest {
  name: string
  version: string
  description: string
  author: { name: string }
  skills: string
  mcpServers: string
  interface: {
    displayName: string
    shortDescription: string
    longDescription: string
    developerName: string
    category: string
    capabilities: string[]
    websiteURL: string
    supportURL: string
    privacyPolicyURL: string
    termsOfServiceURL: string
    defaultPrompt: string[]
    brandColor: string
    composerIcon: string
    logo: string
  }
}

interface McpConfig {
  mcpServers: Record<string, { type: string; url: string; http_headers_helper: string }>
}

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function headersHelper(): Promise<string> {
  return (await json<McpConfig>(join(PLUGIN_ROOT, '.mcp.json'))).mcpServers.hronaut.http_headers_helper
}

async function writeToken(directory: string, content: string): Promise<void> {
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'mcp-token'), content, { mode: 0o600 })
}

/** Width and height of a PNG, from its IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

describe('the Codex plugin', () => {
  it('is listed in the repository’s Codex marketplace', async () => {
    // `codex plugin marketplace add hronaut/hronaut-codex-plugin`, then `codex plugin add hronaut@hronaut`.
    const marketplace = await json<{ name: string; interface: { displayName: string }; plugins: unknown[] }>('.agents/plugins/marketplace.json')
    expect(marketplace).toEqual({
      name: 'hronaut',
      interface: { displayName: 'Hronaut' },
      plugins: [{
        name: 'hronaut',
        source: { source: 'local', path: './plugins/hronaut' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Developer Tools'
      }]
    })
  })

  it('has the manifest fields Codex requires, within the plugin directory’s limits', async () => {
    const plugin = await json<CodexManifest>(join(PLUGIN_ROOT, '.codex-plugin/plugin.json'))
    expect(plugin).toMatchObject({ name: 'hronaut', description: STORE_DESCRIPTION, author: { name: 'Hronaut' }, skills: './skills/', mcpServers: './.mcp.json' })
    const listing = plugin.interface
    expect(listing).toMatchObject({
      displayName: 'Hronaut',
      developerName: 'Hronaut',
      category: 'Developer Tools',
      websiteURL: 'https://hronaut.dev',
      supportURL: 'https://github.com/hronaut/hronaut/issues',
      privacyPolicyURL: 'https://hronaut.dev/privacy',
      termsOfServiceURL: 'https://hronaut.dev/terms'
    })
    expect(listing.shortDescription.length).toBeLessThanOrEqual(30)
    expect(listing.longDescription.length).toBeLessThanOrEqual(4000)
    expect(listing.capabilities.length).toBeLessThanOrEqual(20)
    expect(listing.defaultPrompt.length).toBeLessThanOrEqual(3)
    for (const prompt of listing.defaultPrompt) expect(prompt.length).toBeLessThanOrEqual(128)
    expect(listing.brandColor).toMatch(/^#[0-9A-F]{6}$/)
    for (const icon of [listing.composerIcon, listing.logo]) {
      const [width, height] = pngSize(await readFile(join(PLUGIN_ROOT, icon)))
      expect(width).toBe(height)
      expect(width).toBeGreaterThanOrEqual(48)
    }
  })

  it('names the version of its newest changelog entry, so installed plugins update with each change', async () => {
    const plugin = await json<CodexManifest>(join(PLUGIN_ROOT, '.codex-plugin/plugin.json'))
    expect((await readFile('CHANGELOG.md', 'utf8')).match(/^## (\S+)/m)?.[1]).toBe(plugin.version)
  })

  it('ships the Hronaut skill and the repository’s MIT license, unlike the Hronaut app', async () => {
    const license = await readFile('LICENSE', 'utf8')
    expect(license).toMatch(/^MIT License\r?\n\r?\nCopyright \(c\) 2026 Hronaut\r?\n/)
    // Codex installs only the plugin's folder, so the license is a copy there.
    expect(await readFile(join(PLUGIN_ROOT, 'LICENSE'), 'utf8')).toBe(license)
    expect((await json<{ license: string }>(join(PLUGIN_ROOT, '.codex-plugin/plugin.json'))).license).toBe('MIT')
    expect((await json<{ license: string }>('package.json')).license).toBe('MIT')
    // The daily sync copies the skill from the app, whose copy names the app's license, and marks this copy MIT.
    const skill = await readFile(join(PLUGIN_ROOT, 'skills/hronaut/SKILL.md'), 'utf8')
    expect(skill).toMatch(/^---\r?\nname: hronaut\r?\n/)
    expect(skill).toMatch(/^---\r?\n(?:(?!---)[^\n]*\n)*license: MIT\r?\n/)
  })

  it('connects to Hronaut’s local endpoint, with the owner token its headers helper reads', async () => {
    const config = await json<McpConfig>(join(PLUGIN_ROOT, '.mcp.json'))
    // The address is fixed here and users can't change a plugin's address, so the token goes only to Hronaut's port on
    // this computer. bearer_token_env_var would stop the server from starting wherever the variable isn't set.
    expect(config).toEqual({
      mcpServers: {
        hronaut: { type: 'http', url: `http://127.0.0.1:${DEFAULT_MCP_PORT}/mcp`, http_headers_helper: expect.any(String) }
      }
    })
    // Codex runs the helper with sh on macOS and Linux and with cmd.exe on Windows, from the session's folder rather
    // than the plugin's, so the command is self-contained: an absolute /bin/sh that cmd.exe can't find, then PowerShell.
    const helper = config.mcpServers.hronaut.http_headers_helper
    expect(helper.startsWith('"/bin/sh" -c "')).toBe(true)
    expect(helper).toContain('" || powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "')
    // cmd.exe reads the sh part only inside quotes and expands %VARIABLE% pairs anywhere, so neither shell is surprised.
    expect(helper.match(/"/g)).toHaveLength(6)
    expect(helper.match(/%/g)).toHaveLength(1)
    // The sh part passes its $ through to the inner sh; the PowerShell part never runs in sh and has no $( for it to parse.
    expect(helper.split('" || ')[0]).not.toMatch(/(?<!\\)\$/)
    expect(helper.split('" || ')[1]).not.toMatch(/\$\(|`/)
    // Hronaut writes tokens matching /^[A-Za-z0-9_-]{32,}$/ (TOKEN_PATTERN in the app); the daily sync checks that it still does.
    // The sh part lists the characters: macOS's sh (bash 3.2) matches a range such as a-z by the locale's collation, so é falls inside.
    expect(helper).toContain('case \\$t in *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-]*) t= ;; esac; if [ \\${#t} -ge 32 ]')
    expect(helper).toContain("$t -cmatch '^[A-Za-z0-9_-]{32,}\\z'")
    expect(helper).toContain(`cd ~/Library/Application\\ Support/${PROFILE_FOLDER} || cd ~/.config/${PROFILE_FOLDER}`)
    expect(helper).toContain(`$env:APPDATA + '\\${PROFILE_FOLDER}\\mcp-token'`)
    // Only .NET calls and operators: a cmdlet such as Join-Path makes Windows PowerShell load its module first, which took
    // half a minute on a CI runner, past the 10 seconds Codex gives the helper.
    expect(helper.split('" || ')[1]).not.toMatch(/\b[A-Z][a-z]+-[A-Z][A-Za-z]+\b/)
  })
})

describe.skipIf(process.platform === 'win32')('the Codex plugin’s headers helper', () => {
  let home: string
  let session: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'hronaut-codex-'))
    session = join(home, 'project')
    await mkdir(session)
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true })
  })

  /** Runs the helper as Codex does: `sh -c` from the session's folder, with only the variables Codex passes on. */
  async function headers(environment: Record<string, string> = {}, { withHome = true } = {}): Promise<unknown> {
    const env: Record<string, string> = {}
    for (const name of CODEX_HELPER_VARIABLES) if (process.env[name] !== undefined) env[name] = process.env[name]
    delete env.HOME
    Object.assign(env, withHome ? { HOME: home } : {}, environment)
    const { stdout, stderr } = await run('sh', ['-c', await headersHelper()], { cwd: session, env })
    // Codex takes the output as the headers and fails the connection when the helper fails.
    expect(stderr).toBe('')
    expect(await readdir(session)).toEqual([])
    return JSON.parse(stdout)
  }

  it('sends the token from the profile Hronaut uses on Linux and macOS', async () => {
    await writeToken(join(home, '.config', PROFILE_FOLDER), `${TOKEN}\n`)
    expect(await headers()).toEqual({ Authorization: `Bearer ${TOKEN}` })
    await writeToken(join(home, 'Library', 'Application Support', PROFILE_FOLDER), `${TOKEN}m\n`)
    expect(await headers()).toEqual({ Authorization: `Bearer ${TOKEN}m` })
  })

  it('reads the token file as Hronaut does, trimming it', async () => {
    await writeToken(join(home, '.config', PROFILE_FOLDER), `﻿ ${TOKEN}\t \r\n\n`)
    expect(await headers()).toEqual({ Authorization: `Bearer ${TOKEN}` })
  })

  it('sends no header without a token file, or for a file that does not hold a Hronaut token', async () => {
    // Hronaut accepts the connection without one while its MCP authentication is off.
    expect(await headers()).toEqual({})
    expect(await headers({}, { withHome: false })).toEqual({})
    await mkdir(join(home, 'Library', 'Application Support', PROFILE_FOLDER), { recursive: true })
    expect(await headers()).toEqual({})
    for (const content of ['short-token\n', `${TOKEN}"}\n`, `${TOKEN}é\n`, '']) {
      await writeToken(join(home, 'Library', 'Application Support', PROFILE_FOLDER), content)
      expect(await headers()).toEqual({})
    }
  })
})

// Codex runs the helper with `cmd.exe /Q /D /C "<command>"` on Windows. Each run starts Windows PowerShell.
describe.runIf(process.platform === 'win32')('the Codex plugin’s headers helper on Windows', { timeout: 60_000 }, () => {
  let home: string
  let session: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'hronaut-codex-'))
    session = join(home, 'project')
    await mkdir(session)
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true })
  })

  async function headers(): Promise<unknown> {
    const env: Record<string, string> = {}
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined && CODEX_WINDOWS_HELPER_VARIABLES.includes(name.toUpperCase())) env[name] = value
    }
    for (const name of Object.keys(env)) if (name.toUpperCase() === 'APPDATA') delete env[name]
    env.APPDATA = join(home, 'Roaming')
    const command = `"${await headersHelper()}"`
    const started = Date.now()
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.env.ComSpec ?? 'cmd.exe', ['/Q', '/D', '/C', command], { cwd: session, env, windowsVerbatimArguments: true })
      let output = ''
      child.stdout.on('data', (chunk) => { output += chunk })
      child.on('error', reject)
      child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(`exit ${code}: ${output}`)))
    })
    // Codex stops the helper after 10 seconds.
    expect(Date.now() - started).toBeLessThan(8_000)
    // The sh part fails in cmd.exe before it runs, even where Git's sh is on the PATH, and leaves nothing behind.
    expect(await readdir(session)).toEqual([])
    return JSON.parse(stdout)
  }

  it('sends the token from the profile in %APPDATA%', async () => {
    await writeToken(join(home, 'Roaming', PROFILE_FOLDER), `﻿${TOKEN}\r\n`)
    expect(await headers()).toEqual({ Authorization: `Bearer ${TOKEN}` })
  })

  it('sends no header for a missing or malformed token', async () => {
    expect(await headers()).toEqual({})
    await writeToken(join(home, 'Roaming', PROFILE_FOLDER), `${TOKEN}"}\r\n`)
    expect(await headers()).toEqual({})
  })
})

/** Stops a Codex CLI process and waits until Codex has exited, so its files in CODEX_HOME are closed. */
async function stop(cli: ChildProcess): Promise<void> {
  if (cli.exitCode !== null || cli.signalCode !== null) return
  const exited = new Promise((resolve) => cli.once('exit', resolve))
  // The CLI's script runs Codex's own binary. It passes signals on elsewhere, but Windows ends the script alone.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(cli.pid), '/t', '/f'])
  else cli.kill()
  await exited
}

/** The Codex CLI, when it is installed next to this repository's packages, as CI does. */
function codexCli(): string | undefined {
  try {
    return createRequire(import.meta.url).resolve('@openai/codex/bin/codex.js')
  } catch {
    return undefined
  }
}

// Installs the plugin from this checkout with the real Codex CLI and checks that Codex connects to Hronaut's port with
// the token from the profile. A stand-in for Hronaut answers on the port; Codex never reaches a model.
describe.runIf(codexCli() !== undefined)('the Codex plugin in Codex', { timeout: 120_000 }, () => {
  let home: string
  let stopServer: () => Promise<void>
  const requests: Array<{ method: string; authorization?: string; rpc?: string }> = []

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'hronaut-codex-e2e-'))
    requests.length = 0
    const server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => { body += chunk })
      request.on('end', () => {
        const message = body ? JSON.parse(body) as { id?: number; method?: string; params?: { protocolVersion?: string } } : undefined
        requests.push({ method: request.method ?? '', authorization: request.headers.authorization, rpc: message?.method })
        if (request.headers.authorization !== `Bearer ${TOKEN}`) {
          response.writeHead(401).end()
        } else if (request.method !== 'POST') {
          response.writeHead(405).end()
        } else if (message?.id === undefined) {
          response.writeHead(202).end()
        } else {
          const result = message.method === 'initialize'
            ? { protocolVersion: message.params?.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'hronaut-stand-in', version: '0.0.0' } }
            : message.method === 'tools/list'
              ? { tools: [{ name: 'browser_status', description: 'Reports the browser status.', inputSchema: { type: 'object', properties: {} } }] }
              : {}
          response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }))
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(DEFAULT_MCP_PORT, '127.0.0.1', resolve))
    stopServer = () => new Promise((resolve) => server.close(() => resolve()))
  })

  afterEach(async () => {
    await stopServer()
    // Windows keeps the session's folder busy for a moment after Codex exits.
    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
  }, 60_000)

  it('installs from the repository’s marketplace and connects with the token from Hronaut’s profile', async () => {
    const profile = process.platform === 'win32'
      ? join(home, 'Roaming', PROFILE_FOLDER)
      : process.platform === 'darwin'
        ? join(home, 'Library', 'Application Support', PROFILE_FOLDER)
        : join(home, '.config', PROFILE_FOLDER)
    await writeToken(profile, `${TOKEN}\n`)
    const project = join(home, 'project')
    await mkdir(project)
    const env: Record<string, string | undefined> = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: join(home, 'Roaming'), CODEX_HOME: join(home, '.codex') }
    delete env.HRONAUT_MCP_TOKEN
    await mkdir(env.CODEX_HOME!, { recursive: true })
    const codex = (...args: string[]) => run(process.execPath, [codexCli()!, ...args], { env, cwd: project })

    await codex('plugin', 'marketplace', 'add', process.cwd())
    await codex('plugin', 'add', 'hronaut@hronaut')
    const servers = JSON.parse((await codex('mcp', 'list', '--json')).stdout) as Array<{ name: string; transport: { url: string } }>
    expect(servers).toEqual([expect.objectContaining({ name: 'hronaut', transport: expect.objectContaining({ url: `http://127.0.0.1:${DEFAULT_MCP_PORT}/mcp` }) })])

    // A session starts its MCP servers before it asks the model, which here is an address nothing answers.
    const session = spawn(process.execPath, [
      codexCli()!, 'exec', '--skip-git-repo-check',
      '-c', 'model_provider="stand-in"',
      '-c', 'model_providers.stand-in={name="stand-in",base_url="http://127.0.0.1:9/v1",wire_api="responses"}',
      '-c', 'model="stand-in"',
      'Say hi.'
    ], { env, cwd: project, stdio: 'ignore' })
    try {
      const deadline = Date.now() + 90_000
      while (!requests.some((request) => request.rpc === 'tools/list') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    } finally {
      await stop(session)
    }
    expect(requests.map((request) => request.rpc)).toEqual(expect.arrayContaining(['initialize', 'tools/list']))
    expect(requests.every((request) => request.authorization === `Bearer ${TOKEN}`)).toBe(true)
  })
})
