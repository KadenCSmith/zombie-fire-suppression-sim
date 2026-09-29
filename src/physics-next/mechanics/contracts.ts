/** Local type shape for the isolated mechanics kernels and their fixtures.
 * This is not the shared coupled-solver contract or an active state adapter.
 */
export interface Grid3D {
  readonly nx: number
  readonly ny: number
  readonly nz: number
  readonly dxM: number
  readonly dyM: number
  readonly dzM: number
  readonly cellVolumeM3: number
}

export interface CoupledPrimaryState {
  readonly timeS: number
  readonly grid: Grid3D
  readonly temperatureK: Float64Array
  readonly gasPressurePa: Float64Array
  readonly liquidPressurePa: Float64Array
  readonly porosity: Float64Array
  readonly liquidKg: Float64Array
  readonly iceKg: Float64Array
  readonly gasMol: readonly [Float64Array, Float64Array, Float64Array, Float64Array]
}
