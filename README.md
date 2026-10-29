# Hronaut for Codex

**Give your coding agent its own browser. Keep yours.**

The Codex plugin for [Hronaut](https://hronaut.dev), a visible desktop browser for coding agents, with a separate
workspace for each project. It adds Hronaut's MCP server and the Hronaut skill to Codex CLI and Codex in the ChatGPT
desktop app. Start Hronaut, then:

```bash
codex plugin marketplace add hronaut/hronaut-codex-plugin
codex plugin add hronaut@hronaut
```

Or, after adding the marketplace, install **Hronaut** from `/plugins` in Codex CLI or from **Plugins** in the ChatGPT
desktop app. What the plugin does and how it connects: [plugins/hronaut/README.md](plugins/hronaut/README.md). The
Claude Code plugin is in [hronaut/hronaut-claude-plugin](https://github.com/hronaut/hronaut-claude-plugin), and
Hronaut itself in [hronaut/hronaut](https://github.com/hronaut/hronaut); report problems
[there](https://github.com/hronaut/hronaut/issues).

## Repository layout

- `.agents/plugins/marketplace.json`: the marketplace `codex plugin marketplace add` reads, with one plugin.
- `plugins/hronaut/`: the plugin, exactly as Codex installs it.
- `tests/`: checks of the marketplace, the manifest and the headers helper on Linux, macOS and Windows, and an
  end-to-end test that installs the plugin with the Codex CLI, when it is installed.
- `.github/workflows/sync.yml`: once a day copies the Hronaut skill from the newest Hronaut release into the plugin,
  and releases a new patch version when it changed.

## Development

```bash
npm ci
npm install --no-save @openai/codex@0.165.0   # for the end-to-end test
npm test
```

Every change users should get bumps `version` in `plugins/hronaut/.codex-plugin/plugin.json` and adds a
[CHANGELOG](CHANGELOG.md) entry with that version. See [AGENTS.md](AGENTS.md) for how the headers helper works.

## License

The plugin, including its copy of the Hronaut skill, is open source under the [MIT License](LICENSE). Hronaut itself,
the app it connects to, is a separate product under the
[Hronaut Subscription and Trial License](https://github.com/hronaut/hronaut/blob/main/LICENSE): a 10-day trial, then
a subscription. [What you can do without paying](https://hronaut.dev/#faq).
