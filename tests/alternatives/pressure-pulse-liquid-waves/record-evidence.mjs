import { createServer } from 'vite'
import { writeFile } from 'node:fs/promises'

// Optional reproducible numerical record. Uses the same public external seam,
// without a browser, original edits, private solver copies or listening port.
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { freshPanel, createRun } = await server.ssrLoadModule('/src/alternatives/model.ts')
  const { ALTERNATIVE_CONTACT_STEP_S } = await server.ssrLoadModule('/src/alternatives/contactAdapter.ts')
  const config = freshPanel('evidence-liquid-waves', 'liquid-waves')
  const run = createRun(config), beforeArrival = run.advanceTo(config.thermal.contactStartS)
  const final = run.advanceTo(config.thermal.endS)
  const offConfig = structuredClone(config); offConfig.thermal.enabled = false
  const off = createRun(offConfig).advanceTo(config.thermal.endS)
  const baselineConfig = freshPanel('evidence-baseline', 'baseline')
  baselineConfig.thermal.contactStartS = config.thermal.contactStartS
  const baseline = createRun(baselineConfig).advanceTo(config.thermal.endS)
  const record = {
    kind: 'numerical verification only; no experiments', apiVersion: 'v21.2',
    alternativeStepS: ALTERNATIVE_CONTACT_STEP_S, protectedReferenceDefaultStepS: .05,
    reproduction: 'node tests/alternatives/pressure-pulse-liquid-waves/record-evidence.mjs',
    config, beforeArrival: { timeS: beforeArrival.timeS, metrics: beforeArrival.metrics },
    final: { timeS: final.timeS, metrics: final.metrics, ledger: final.contact.ledger },
    offMatchesMatchedReference: JSON.stringify(off) === JSON.stringify(baseline),
    missing: ['pressure transport', 'infiltration', 'soil mechanics', 'reaction', 'suppression', 're-ignition'],
  }
  await writeFile(new URL('../../../docs/alternatives/pressure-pulse-liquid-waves/numerical-evidence.json', import.meta.url), JSON.stringify(record, null, 2) + '\n')
  console.log(JSON.stringify({ beforeArrival: record.beforeArrival, final: record.final, offMatchesMatchedReference: record.offMatchesMatchedReference }, null, 2))
} finally {
  await server.close()
}
