# Changelog

Each entry is a version of the plugin. Codex installs plugins by the version in
`plugins/hronaut/.codex-plugin/plugin.json`, so every change that reaches users bumps it and adds an entry here.

## 1.0.3 - 2026-10-29

- New description in the plugin listing and README: "Give your coding agent its own browser. Keep yours."
  Hronaut is a visible desktop browser for coding agents, with a separate workspace for each project. The plugin
  itself is unchanged.

## 1.0.2 - 2026-10-28

- The plugin is now open source under the MIT License, including its copy of the Hronaut skill. Hronaut itself, the
  app the plugin connects to, keeps its Subscription and Trial License.

## 1.0.1 - 2026-10-28

- Moves to its own repository, hronaut/hronaut-codex-plugin. Add the marketplace with
  `codex plugin marketplace add hronaut/hronaut-codex-plugin`.

## 1.0.0 - 2026-10-28

- First version: Hronaut's MCP server at `http://127.0.0.1:47812/mcp` with the owner token from Hronaut's profile,
  and the Hronaut skill from Hronaut 3.12.0.
