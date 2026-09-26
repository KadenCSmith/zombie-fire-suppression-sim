# Research composition menus

Version 0.4.0 · 2026-09-26

Open **Simulation → Developer → Research profiles**, or use **Choose a research material profile** in Setup’s ground controls. The menus are organized by researched material, with three families: **Moss peat**, **Organic field soil**, and **Peat and sand mixtures**.

1. Choose the base soil matrix or an existing peat region.
2. Read the value interpretation and missing-data note, then **Stage this profile**.
3. Inspect the staged values in Ground, Peat or another property group. Edit them if needed.
4. **Apply & restart** validates the combined inputs and starts a fresh physical run. **Discard** removes the draft.
5. **Export applied values + sources** saves the scenario, original profile values, edits and ASCE source records. A regular scenario export also keeps profile metadata.

Drafts are local to Developer tools and are discarded when leaving the tab. Applying a profile replaces any earlier staged edits. Export uses applied values only.

## Available comparisons

| Material | Dry density kg/m³ | Organic dry-mass fraction | Initial water/dry mass kg/kg | Dry bulk k W/(m·K) | Dry cp J/(kg·K) | Sources |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Irish moss peat | 135 | 0.98 | 0 | Retained assumption | 1840 | HR17 |
| Andean organic soil | 271.5 | 0.917 | 1.145 | Retained assumption | Retained assumption | P17 |
| Lowland peat | 310 | 0.734 | 0 | 0.05 | 1609.68 | D25, AT23 |
| 80% lowland peat · 20% sand | 370 | 0.592 | 0 | 0.049 | 1418.92 | D25, AT23 |
| 60% lowland peat · 40% sand | 460 | 0.45 | 0 | 0.042 | 1221.74 | D25, AT23 |
| 40% lowland peat · 60% sand | 460 | 0.305 | 0 | 0.095 | 1665.22 | D25, AT23 |
| 20% lowland peat · 80% sand | 870 | 0.159 | 0 | 0.108 | 887.356 | D25, AT23 |
| 10% lowland peat · 90% sand | 930 | 0.082 | 0 | 0.151 | 1032.26 | D25, AT23 |
| 5% lowland peat · 95% sand | 1130 | 0.044 | 0 | 0.206 | 922.124 | D25, AT23 |
| 3% lowland peat · 97% sand | 1340 | 0.028 | 0 | 0.233 | 805.97 | D25, AT23 |
| 1% lowland peat · 99% sand | 1400 | 0.013 | 0 | 0.557 | 812.857 | D25, AT23 |
| Quarry sand | 1630 | 0.0045 | 0 | 0.63 | 719.018 | D25, AT23 |

## How to interpret these values

**Irish moss peat (HR17):** oven-dry density is observed; organic content is inferred from inorganic residue. Heat capacity and particle density are published model inputs. The dry reference uses zero water and does not recreate the column experiment.

**Andean organic soil (P17):** density and organic content use explicitly labeled midpoints of unpaired field ranges. Initial moisture is the reported average on a dry-mass basis, converted to pore saturation. This is a comparison assembled from reported statistics, not a particular measured specimen.

**Peat–sand mixtures (D25 / AT23):** the ten dry sample blend ratios are 100, 80, 60, 40, 20, 10, 5, 3, 1 and 0% peat. Peat percentage is not organic-matter percentage. D25 Table 4 supplies measured dry density and estimated organic matter, dry conductivity and dry volumetric heat capacity. Specific heat is volumetric heat capacity divided by dry density. Zero water is an assumed dry limit of air-dried samples. These thermal estimates are not calibrated at wet or smoldering conditions.

## What selecting a target changes

| Target | Changes | Retained assumptions / shared effects |
| --- | --- | --- |
| Base soil matrix | Dry density, organic fraction, derived porosity, converted moisture; thermal properties when supplied; mineral texture for Andean soil and quarry sand; all soil-layer property multipliers/offsets become neutral | Layer geometry, existing peat-region overrides, source, ignition, root fuel and all unreported parameters remain. Neutralizing layers is an explicit modeling choice, recorded in the audit. |
| Selected peat region | Its density, organic fraction and moisture | Peat heat capacity and conductivity are shared across all peat regions. Irish particle density is also a shared end member. Dry thermal profiles set the saturation conductivity slope to zero; changing moisture later requires a suitable constitutive law. |

Porosity is derived from mass-fraction specific-volume mixing, using editable particle-density assumptions. It is not independently measured in these menus. User edits are labeled as assumptions even when a profile is still selected. Profile metadata is descriptive; the solver always uses the actual numeric settings.

The default base-soil texture, permeability, compaction, chemistry and strength cannot be inferred from a peat–sand mass ratio alone. In particular, the remaining mineral part of a mixture is not automatically assigned 100% sand, because its peat component contains minerals of unspecified gradation. Only the quarry-sand end member sets the mineral texture to all sand.

**These comparisons are not a replication or validation of the studies.** Geometry, ignition, boundary conditions and missing constitutive laws differ. The separate Scene studio illustration keeps its authored appearance when a research profile is applied.

Full ASCE citations, reasons for use and the supplied working-document audit are in [Material evidence](MATERIAL_EVIDENCE_ASCE.md). Table data attribution is recorded in [Third-party notices](../THIRD_PARTY_NOTICES.md).
