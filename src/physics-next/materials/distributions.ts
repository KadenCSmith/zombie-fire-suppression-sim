import {
  copyData, fail, freezeData, identifier, keys, list, number, parseParameterRecord,
  readCitations, readProvenance, text, unique,
} from './schema'
import type { CitationReference, DistributionValue, ParameterRecord, Provenance } from './schema'
import { MaterialRegistry } from './registry'

export interface DistributionMetadata {
  readonly format: 'zfs-distribution-metadata'
  readonly version: 1
  readonly record: ParameterRecord
  readonly distribution: DistributionValue
  readonly supportSI: readonly [number, number]
  readonly use: 'metadata-only-no-sampling-or-validation'
}

/**
 * Bounded support only. "location" and "scale" on truncated-normal describe
 * the underlying untruncated normal, not the mean/SD after truncation.
 * No PDF evaluation, draws, fitting, moments, or uncertainty propagation.
 */
export function describeDistribution(input: unknown): DistributionMetadata {
  const record = parseParameterRecord(input)
  if (record.value.form !== 'distribution')
    return fail('DISTRIBUTION', record.id, 'Expected an explicit bounded distribution record.')
  const d = record.value, width = d.upper.valueSI - d.lower.valueSI
  if (!Number.isFinite(width) || width <= 0)
    return fail('DISTRIBUTION', record.id, 'Support width must be positive and finite in SI.')
  return freezeData({
    format: 'zfs-distribution-metadata', version: 1, record, distribution: d,
    supportSI: [d.lower.valueSI, d.upper.valueSI],
    use: 'metadata-only-no-sampling-or-validation',
  })
}

export const CORRELATION_PSD_TOLERANCE_PER_DIMENSION = 1e-12 as const
export interface CorrelationMetadata {
  readonly format: 'zfs-material-correlation'
  readonly version: 1
  readonly id: string
  readonly kind: 'pearson'
  readonly unit: '1'
  /** Reported order is preserved; matrix row/column order always matches. */
  readonly recordIds: readonly string[]
  readonly matrix: readonly (readonly number[])[]
  readonly citations: readonly CitationReference[]
  readonly provenance: Provenance
  readonly note: string
}

function checkPositiveSemidefinite(matrix: readonly (readonly number[])[]): void {
  const n = matrix.length
  const tolerance = n * CORRELATION_PSD_TOLERANCE_PER_DIMENSION
  const lower = Array.from({ length: n }, () => Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    let diagonal = matrix[i][i]
    for (let k = 0; k < i; k++) diagonal -= lower[i][k] * lower[i][k]
    if (!Number.isFinite(diagonal) || diagonal < -tolerance)
      fail('CORRELATION_PSD', '$.matrix', 'Matrix fails the finite-precision positive-semidefinite check.')
    lower[i][i] = Math.sqrt(Math.max(0, diagonal))
    for (let j = i + 1; j < n; j++) {
      let residual = matrix[j][i]
      for (let k = 0; k < i; k++) residual -= lower[j][k] * lower[i][k]
      if (lower[i][i] === 0) {
        if (Math.abs(residual) > tolerance)
          fail('CORRELATION_PSD', '$.matrix', 'Singular pivot has a nonzero residual coupling.')
      } else {
        const value = residual / lower[i][i]
        if (!Number.isFinite(value)) fail('CORRELATION_PSD', '$.matrix', 'Nonfinite factorization.')
        lower[j][i] = value
      }
    }
  }
}

/**
 * PSD is necessary, not sufficient for realizability with the specified
 * bounded marginal distributions. Passing this parser does NOT authorize
 * a joint sampler or a copula, nor imply measured statistical dependence.
 */
export function parseCorrelation(input: unknown, registry: MaterialRegistry): CorrelationMetadata {
  if (!(registry instanceof MaterialRegistry))
    return fail('REGISTRY', '$.registry', 'Expected an immutable parsed registry.')
  const v = keys(copyData(input), [
    'format', 'version', 'id', 'kind', 'unit', 'recordIds', 'matrix', 'citations', 'provenance', 'note',
  ], '$')
  if (v.format !== 'zfs-material-correlation' || v.version !== 1)
    fail('VERSION', '$', 'Unsupported correlation format/version.')
  if (v.kind !== 'pearson' || v.unit !== '1')
    fail('CORRELATION_KIND', '$', 'Only explicit unitless Pearson metadata is supported; no rank/copula conversion.')
  const recordIds = list(v.recordIds, '$.recordIds').map((x, i) => identifier(x, `$.recordIds[${i}]`))
  unique(recordIds, '$.recordIds')
  const n = recordIds.length
  if (n < 2 || n > 64) fail('CORRELATION_SIZE', '$.recordIds', 'Provide 2 through 64 explicit distribution records.')
  for (const id of recordIds) {
    const record = registry.getRecord(id)
    if (!record) fail('DANGLING_RECORD', id, 'Correlation references absent evidence.')
    describeDistribution(record)
  }
  const matrix = list(v.matrix, '$.matrix').map((row, i) => list(row, `$.matrix[${i}]`)
    .map((cell, j) => number(cell, `$.matrix[${i}][${j}]`)))
  if (matrix.length !== n || matrix.some(row => row.length !== n))
    fail('CORRELATION_SIZE', '$.matrix', 'Matrix dimensions must match the record order.')
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cell = matrix[i][j]
    if (cell < -1 || cell > 1) fail('CORRELATION_BOUNDS', '$.matrix', 'Coefficients must be in [-1, 1].')
    if (i === j && cell !== 1) fail('CORRELATION_DIAGONAL', '$.matrix', 'Diagonal must be exactly one.')
    if (cell !== matrix[j][i]) fail('CORRELATION_SYMMETRY', '$.matrix', 'Matrix must be explicitly symmetric; no silent repair.')
  }
  checkPositiveSemidefinite(matrix)
  const citations = readCitations(v.citations, '$.citations')
  const provenance = readProvenance(v.provenance, citations, '$.provenance')
  if (provenance.status === 'unknown' || provenance.status === 'derived')
    fail('CORRELATION_PROVENANCE', '$.provenance', 'Unknown coefficients need no numeric matrix; correlation derivation graphs are not supported.')
  for (const citation of citations) {
    if (!registry.getSource(citation.sourceId))
      fail('DANGLING_SOURCE', citation.sourceId, 'Correlation source is absent from the registry.')
  }
  return freezeData({
    format: 'zfs-material-correlation', version: 1, id: identifier(v.id, '$.id'),
    kind: 'pearson', unit: '1', recordIds, matrix, citations, provenance, note: text(v.note, '$.note'),
  })
}
