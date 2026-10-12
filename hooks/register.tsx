import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, ModelTally, UsageSnapshot } from '../types'

const PANE = 'usage-meters'
const snapshot = atom({ plugin: 'usage-meters', key: 'snapshot' } as const, null)
const models = atom({ plugin: 'usage-meters', key: 'models' } as const, {})

const FULL = '█'
const EMPTY = '░'

const bar = (percent: number, width: number) => {
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.round((clamped / 100) * width)
  return FULL.repeat(filled) + EMPTY.repeat(width - filled)
}

const tone = (percent: number) => (percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green')

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

const resetsIn = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  if (minutes >= 1440) return `resets ${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `resets ${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `resets ${minutes}m`
}

const monthKey = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}


// Month spend is the user's own tally: session costs summed in $.store.
async function tallyMonth($: any, sessionUsd: number | undefined) {
  const now = await $.clock.now()
  const key = monthKey(now)
  const sessionId = await $.session.id()
  let ledger = (await $.store.get('ledger')) as
    | { month: string; usd: number; sessionId: string; sessionUsd: number }
    | undefined
  if (!ledger || ledger.month !== key) {
    ledger = { month: key, usd: 0, sessionId, sessionUsd: 0 }
  }
  if (sessionUsd !== undefined) {
    const delta = ledger.sessionId === sessionId ? sessionUsd - ledger.sessionUsd : sessionUsd
    if (delta > 0) ledger.usd += delta
    ledger.sessionId = sessionId
    ledger.sessionUsd = sessionUsd
    await $.store.set('ledger', ledger)
  }
  return { usd: ledger.usd, key }
}

async function refresh($: any, budget: number) {
  const usage = await $.session.usage()
  const month = await tallyMonth($, usage.cost?.usd)
  const pick = (kind: string): Limit | undefined => {
    const w = usage.rateLimits.find((r: any) => r.kind === kind)
    return w && { percentUsed: w.percentUsed, resetsAt: w.resetsAt }
  }
  const model = await $.session.model()
  const snap: UsageSnapshot = {
    model,
    contextTokens: usage.context.tokens,
    contextWindow: usage.context.window,
    contextPercent: usage.context.percent,
    fiveHour: pick('five_hour'),
    sevenDay: pick('seven_day'),
    sessionUsd: usage.cost?.usd,
    monthUsd: month.usd,
    monthBudgetUsd: budget,
    monthLabel: month.key,
  }
  await update($, snapshot, () => snap)
  const five = snap.fiveHour ? `5h ${Math.round(snap.fiveHour.percentUsed)}%` : '5h --'
  const week = snap.sevenDay ? `7d ${Math.round(snap.sevenDay.percentUsed)}%` : '7d --'
  const ctx = snap.contextPercent !== undefined ? `ctx ${snap.contextPercent}%` : 'ctx --'
  $.ui.status(`${model.replace(/^claude-/, '')} · ${ctx} · ${five} · ${week}`)
}


async function draw($: any, e: any, columns: number) {
  const { Box, Text } = $.ui.resolve(e)
  const snap = await read($, snapshot)
  const byModel = await read($, models)
  const now = await $.clock.now()
  const width = Math.max(10, Math.min(30, columns - 34))

  if (!snap) return <Text dimColor>Waiting for the first reading…</Text>

  const row = (label: string, percent: number | undefined, detail: string) => (
    <Box>
      <Text>{label.padEnd(9)}</Text>
      {percent === undefined ? (
        <Text dimColor>{EMPTY.repeat(width)} n/a</Text>
      ) : (
        <Text color={tone(percent)}>{bar(percent, width)}</Text>
      )}
      <Text> {percent === undefined ? '' : `${String(Math.round(percent)).padStart(3)}%`} </Text>
      <Text dimColor>{detail}</Text>
    </Box>
  )

  const monthPct = snap.monthBudgetUsd > 0 ? (snap.monthUsd / snap.monthBudgetUsd) * 100 : undefined
  const entries = Object.entries(byModel) as [string, ModelTally][]
  const total = entries.reduce((s, [, t]) => s + t.input + t.output + t.cacheRead + t.cacheWrite, 0)

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Model </Text>
        <Text color="cyan">{snap.model}</Text>
      </Box>
      {row(
        'Context',
        snap.contextPercent,
        snap.contextTokens !== undefined
          ? `${compact(snap.contextTokens)} / ${compact(snap.contextWindow)}`
          : `window ${compact(snap.contextWindow)}`,
      )}
      {row(
        'Session',
        snap.fiveHour?.percentUsed,
        snap.fiveHour ? `5h window, ${resetsIn(snap.fiveHour.resetsAt, now)}` : 'no 5h reading yet',
      )}
      {row(
        'Week',
        snap.sevenDay?.percentUsed,
        snap.sevenDay ? `7d window, ${resetsIn(snap.sevenDay.resetsAt, now)}` : 'no 7d reading yet',
      )}
      {row(
        'Month',
        monthPct,
        `$${snap.monthUsd.toFixed(2)} of $${snap.monthBudgetUsd} (${snap.monthLabel}, your tally)`,
      )}
      <Text dimColor>
        Left: session {snap.fiveHour ? `${Math.round(100 - snap.fiveHour.percentUsed)}%` : '--'} · week{' '}
        {snap.sevenDay ? `${Math.round(100 - snap.sevenDay.percentUsed)}%` : '--'} · month{' '}
        {monthPct !== undefined ? `${Math.max(0, Math.round(100 - monthPct))}%` : '--'}
        {snap.sessionUsd !== undefined ? ` · this session $${snap.sessionUsd.toFixed(2)}` : ''}
      </Text>
      <Text bold> </Text>
      <Text bold>Models this session</Text>
      {entries.length === 0 && <Text dimColor>No completed turns yet.</Text>}
      {entries
        .sort((a, b) => b[1].output + b[1].input - (a[1].output + a[1].input))
        .map(([name, t]) => {
          const tokens = t.input + t.output + t.cacheRead + t.cacheWrite
          const share = total > 0 ? (tokens / total) * 100 : 0
          return row(
            name.replace(/^claude-/, '').slice(0, 8),
            share,
            `${compact(tokens)} tok · ${t.turns} turns · out ${compact(t.output)}`,
          )
        })}
    </Box>
  )
}


export const register: Register = (on, options) => {
  const budget = Number(options.monthlyBudgetUsd) || 100

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'meters',
      description: 'Open the usage meters pane',
    })
    void refresh($, budget)
    void $.ui.open({ id: PANE, title: 'Usage' })
    return next(e)
  })

  on('command.run', { command: 'meters' }, async $ => {
    await refresh($, budget)
    await $.ui.open({ id: PANE, title: 'Usage' })
    return { text: 'Usage meters opened.' }
  })

  on('session.measure', async ($, e, next) => {
    await refresh($, budget)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    if (u) {
      await update($, models, all => {
        const prev: ModelTally = all[u.model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }
        return {
          ...all,
          [u.model]: {
            input: prev.input + u.input_tokens,
            output: prev.output + u.output_tokens,
            cacheRead: prev.cacheRead + u.cache_read_input_tokens,
            cacheWrite: prev.cacheWrite + u.cache_creation_input_tokens,
            turns: prev.turns + 1,
          },
        }
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) =>
    draw($, e, e.props.bodyColumns ?? e.viewport?.columns ?? 80),
  )
}
