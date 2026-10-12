import { expect, mock, test } from 'claude-code/testing'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pane draws a placeholder before the first reading on ${surface}`, async ($, on) => {
    mock.clock(on)
    const ui = await $.ui.mount({
      plugin: 'usage-meters',
      surface,
      component: 'Pane',
      props: { bodyColumns: 80 } as never,
      requestId: 'usage-meters',
    })
    expect(await ui.find({ text: /Waiting for the first reading/ })).toBeDefined()
  })
}
