# Notes for agents

This repository holds Hronaut's Codex plugin (`plugins/hronaut/`) and the marketplace that lists it
(`.agents/plugins/marketplace.json`). The Hronaut app is in hronaut/hronaut, and the Claude Code plugin in
hronaut/hronaut-claude-plugin.

## Versions

- Codex installs plugins by `version` in `plugins/hronaut/.codex-plugin/plugin.json`. Bump it for every change under
  `plugins/hronaut/` and add a `## <version> - <date>` entry at the top of `CHANGELOG.md`; a test checks that they
  match.
- The `Sync from Hronaut` workflow runs daily. It copies `skills/hronaut/SKILL.md` and `LICENSE` from the newest
  hronaut/hronaut release (never from its main branch, which may describe tools not yet released) into the plugin,
  bumps the patch version when they changed, tests and pushes to main. It fails instead when the app's token format
  (`TOKEN_PATTERN` in `src/main/mcp-token-store.ts`), default MCP port (`DEFAULT_MCP_PORT` in
  `src/shared/mcp-port.ts`) or package name (the profile folder) no longer match what the headers helper assumes;
  update the helper and tests, then run it by hand. GitHub turns scheduled workflows off after 60 days without
  activity in the repository; turn it back on in Actions.

## The plugin

- The plugin uses Codex's own manifest format (`.codex-plugin/plugin.json` with `.mcp.json`), not the portable Agent
  Plugins `plugin.json`: only Codex's format accepts `http_headers_helper`. Portable `mcp.json` allows static headers
  only and reserves `Authorization`.
- The address is fixed to Hronaut's default port; users can't change a plugin's address, so the token only goes there.
  A server the user added with `codex mcp add hronaut` replaces the plugin's server of the same name.
- OpenAI's public plugin directory (shared by ChatGPT and Codex) takes local MCP servers only from partners OpenAI
  allowlists, and no plugins with hooks; distribution is this marketplace.

## The headers helper

Codex runs `http_headers_helper` with `sh -c` on macOS and Linux and `cmd.exe /Q /D /C "<command>"` on Windows, from
the session's folder, with only a few variables (`HOME`, `PATH` and the like; `APPDATA` on Windows), no plugin folder
and a 10-second limit. So the helper is one self-contained command: `"/bin/sh" -c "…"`, which cmd.exe can't find, then
`|| powershell …`. `tests/plugin.test.ts` runs it the way Codex does on all three systems.

- Keep exactly six `"` and one `%` in it: cmd.exe expands `%NAME%` pairs and reads special characters only outside
  quotes. Escape the inner script's `$` as `\$`.
- Print `{}` rather than fail: Codex fails the connection when the helper fails.
- The sh part lists the token's characters instead of using ranges: macOS's `/bin/sh` is bash 3.2, which matches `a-z`
  by the locale's collation, so `é` would pass.
- The PowerShell part uses only .NET calls and operators. A cmdlet such as `Join-Path` makes Windows PowerShell load
  its module first, which took about 30 seconds in Codex's environment on a CI runner.
- `.mcp.json` holds the helper as a JSON string. Edit the command as plain text and write it into the file with
  `JSON.stringify`, so the escaping stays right.
