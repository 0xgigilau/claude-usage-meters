# usage-meters

A [Claude Code mod](https://claude.dev/blog/getting-started-with-claude-code-mods/) that draws usage progress bars in a pane beside the transcript, and a compact summary in the status line.

| Bar | Source |
|---|---|
| **Model** | The model the main loop is running (`$.session.model()`) |
| **Context** | Tokens used vs. the model's context window |
| **Session** | The 5-hour rate-limit window, with time until reset |
| **Week** | The 7-day rate-limit window, with time until reset |
| **Month** | Your own running tally of session costs vs. a budget you set |
| **Models** | Each model's share of this session's tokens, turns and output tokens |

A "left" line shows the percent remaining for session, week and month. Bars turn yellow at 70% and red at 90%.

## Install

In a Claude Code terminal session:

```
/plugin install usage-meters --marketplace 0xgigilau/claude-usage-meters
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

Or clone and load from disk:

```
git clone https://github.com/0xgigilau/claude-usage-meters
claude --plugin-dir ./claude-usage-meters
```

## Use

The pane opens at session start and redraws after every turn. Type `/meters` to reopen it if you closed it. The pane needs a wide terminal (about 110 columns, or fullscreen); below that only the status line entry shows.

## Notes

- **Month bar is an estimate.** Claude Code reports no monthly limit. The mod sums the cost of each session in its own store and divides by `monthlyBudgetUsd` (default `100`, set it in `/config`). It starts counting when you install it and resets each calendar month (UTC).
- **Session and Week bars** read "n/a" until Claude Code has a rate-limit reading, and stay that way on API-key accounts.
- The mod API is early access and may change between Claude Code releases.

## Development

```
claude plugin validate .
claude plugin test .
```

MIT licensed.
