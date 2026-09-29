/**
 * Agent F's public API only. No baseline defaults, solver imports or consumer wiring.
 * Canonical SI/JSON checks and eligibility gates are not physical validation.
 */
export {
  UNIT_CATALOG_VERSION, DIMENSIONS, KIND_DIMENSIONS, UNITS, SI_UNITS,
  UnitError, convertValue, parseReportedQuantity, normalizeQuantity,
} from './units'
export type {
  DimensionTag, Dimension, QuantityKind, DimensionFor, UnitId, UnitFor,
  UnitErrorCode, SIValue, AffineTransform, UnitConversion,
  ReportingPrecision, ReportedValue, SIQuantity,
} from './units'
export {
  PARAMETER_FORMAT_VERSION, PROVENANCE_CLAIMS, MaterialDataError,
  parseParameterRecord, serializeParameterRecord,
} from './schema'
export type {
  Quantity, MaterialIdentity, CitationReference, Derivation, ProvenanceStatus,
  Provenance, ApplicabilityBound, CategoryCondition, Applicability,
  ScalarValue, RangeValue, DistributionValue, UnknownValue, ParameterValue, ParameterRecord,
} from './schema'
export {
  SOURCE_FORMAT_VERSION, stableSourceId, parseSourceRecord, buildEvidenceGraph,
} from './provenance'
export type {
  SourceIdentity, SourceRecord, EvidenceEdge, EvidenceGraph,
} from './provenance'
export {
  MATERIAL_SET_FORMAT_VERSION, MaterialRegistry, appendRegistry,
} from './registry'
export type {
  ParameterQuery, EvidenceOverride, ParameterSet, Selection, CompletenessReport,
} from './registry'
export {
  CORRELATION_PSD_TOLERANCE_PER_DIMENSION, describeDistribution, parseCorrelation,
} from './distributions'
export type { DistributionMetadata, CorrelationMetadata } from './distributions'
export {
  parseProjectionRequest, projectScalars, exportEvidenceBundle,
} from './adapters'
export type {
  NumericGuard, ScalarRequirement, ProjectionContext, KnownProvenanceStatus,
  ReadableSourceAvailability, ProjectionPolicy, ProjectionRequest, ProjectionIssue,
  ProjectedValues, ProjectionAudit, ProjectionResult, EvidenceBundle,
} from './adapters'
