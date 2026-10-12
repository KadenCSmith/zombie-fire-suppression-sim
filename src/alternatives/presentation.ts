import { findMethodModule } from './modules'
import { methodPresentationBase } from './presentationBase'
import type { VariantId } from './registry'
export function methodPresentation(id: VariantId, timeS: number) {
  return (findMethodModule(id)?.presentation ?? methodPresentationBase)(id, timeS)
}
