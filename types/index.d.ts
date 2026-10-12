export type Limit = { percentUsed: number; resetsAt?: string }

export type ModelTally = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  turns: number
}

export type UsageSnapshot = {
  model: string
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  fiveHour?: Limit
  sevenDay?: Limit
  sessionUsd?: number
  monthUsd: number
  monthBudgetUsd: number
  monthLabel: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meters': {
      snapshot: UsageSnapshot | null
      models: Record<string, ModelTally>
    }
  }
}
