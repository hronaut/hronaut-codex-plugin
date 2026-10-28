# Hronaut for Codex

Connects Codex to [Hronaut](https://hronaut.dev) — a visible desktop browser it can drive over MCP. Watch every step, pause and take over, keep logins between sessions. Requires the Hronaut app (free 10-day trial at [hronaut.dev](https://hronaut.dev/download)).

The plugin adds Hronaut's MCP server and the Hronaut skill, which teaches Codex to work in its own isolated workspace and hand sign-ins and CAPTCHAs to you. It works in Codex CLI and in Codex in the ChatGPT desktop app. The Codex IDE extension doesn't support plugins; there, add Hronaut with `codex mcp add` as the [setup guide](https://hronaut.dev/codex-browser-mcp) shows.

## Examples

- "Open http://localhost:3000/signup in Hronaut, sign up with test data, and report console errors and failed requests."
- "Check the checkout page on our staging site in Hronaut at 375 and 1280 pixels wide, take screenshots, and list layout problems."
- "Audit http://localhost:5173/settings for accessibility in Hronaut, fix what you find in the code, and audit again to confirm."

## Install

Start Hronaut, then:

```bash
codex plugin marketplace add hronaut/hronaut-codex-plugin
codex plugin add hronaut@hronaut
```

Or, after adding the marketplace, install **Hronaut** from `/plugins` in Codex CLI or from **Plugins** in the ChatGPT desktop app. Start a new session; `/mcp` shows Hronaut. Update with `codex plugin marketplace upgrade hronaut`.

## How it connects

The plugin connects to `http://127.0.0.1:47812/mcp`, Hronaut's local endpoint. Each time Codex connects, the plugin's headers helper reads the owner token from the `mcp-token` file in Hronaut's profile (`~/.config/hronaut` on Linux, `~/Library/Application Support/hronaut` on macOS, `%APPDATA%\hronaut` on Windows) and passes it to Codex's connection, so the token is never written to Codex's configuration or shown to the agent. Hronaut accepts the connection without a token while its MCP authentication is off. The plugin sends nothing anywhere else and stores nothing.

- Added Hronaut with `codex mcp add hronaut` before? Codex keeps using that server instead of the plugin's. Remove it with `codex mcp remove hronaut`.
- Changed Hronaut's MCP port, or start Hronaut with `HRONAUT_USER_DATA_DIR`, `XDG_CONFIG_HOME` or `HRONAUT_MCP_TOKEN`? Codex gives the helper none of these. Add Hronaut with the token-aware command from Hronaut Home instead; Codex then uses that server in place of the plugin's, and the plugin still adds the skill.
Hronaut runs on your computer, so Codex cloud tasks cannot reach it. See the [privacy policy](https://hronaut.dev/privacy).

## License

Hronaut and this plugin are source-available under the [Subscription and Trial License](LICENSE). The 10-day trial starts with the first agent tool call, with no credit card required. Ongoing use requires a subscription afterward: $4/month or $24/year per named user (50% off $48).
