# Finite CO₂ source: heat and mass transfer

## Scope

`src/coupled/source.ts` replaces the former assumption that the dry-ice temperature is always the coexistence temperature at **total** surrounding pressure. The new reduced source solves a finite-rate mass loss and a finite-solid energy balance together. It retains the existing constant-property caloric reference. It is numerically verified, not calibrated or experimentally validated for buried peat.

## Inspected primary evidence

Purandare, A. S., Verbruggen, W. M., and Vanapalli, S. (2023). *Experimental and theoretical investigation of the dry ice sublimation temperature for varying far-field pressure and CO₂ concentration*. International Communications in Heat and Mass Transfer 148, 107042. [DOI](https://doi.org/10.1016/j.icheatmasstransfer.2023.107042); [open primary paper](https://ris.utwente.nl/ws/files/320947389/1-s2.0-S0735193323004311-main.pdf). Accessed 27 September 2026; full relevant methods inspected, PDF pages 3–6, sections 2.3–4.1, equations 2–10 and 15. CC BY paper; no paper code or figures copied.

The experiments use small compressed dry-ice spheres in controlled CO₂/N₂ mixtures, with pressure 0.6–1.3 bar and ambient temperature near 293 K. Their concentration-dependent temperatures demonstrate that −78.5°C at one atmosphere applies to a CO₂-saturated environment. The authors couple interfacial heat transfer to diffusion and Stefan flow, and caution that using far-field partial pressure alone also fails. This supports including finite mass transfer. It does **not** supply a measured porous-soil transfer coefficient, large-source temperature uniformity, or validation of this implementation. No measured curve was fitted and no holdout error is claimed.

## Equations implemented

The following is this project's reduced spherical-film discretization; it does not reproduce the paper's complete variable-property model or its equation 15.

For old finite mass `m₀`, specified density `ρs`, and timestep `Δt`, freeze the geometric radius during the step:

```
r = (3 m₀ / (4 π ρs))^(1/3),  A = 4 π r²
kₘ = D_eff / r                  (assumed quiescent spherical film, Sh = 2)
Tfilm = (T∞ + Ts) / 2,  cfilm = P / (R Tfilm)
y∞ = pCO₂,∞ / P,  ys = psat(Ts) / P
ṁ = A kₘ cfilm MCO₂ ln((1 − y∞)/(1 − ys))
```

The logarithmic expression follows integration of steady binary Stefan diffusion with zero net noncondensing-carrier flux. Here all other gas species form one effective carrier. The application supplies local weighted CO₂ partial pressure, total pressure, temperature, and `D_eff = scenario.soil.gasDiffusivityM2S / scenario.soil.tortuosity`. That coefficient is an explicit scenario assumption for an unresolved film. Pore saturation, contact geometry, convective enhancement, and multicomponent diffusion are not thereby resolved.

For `ys ≤ y∞`, mass loss is zero. Deposition is not implemented; `depositionSuppressed` reports this limitation. For `ys → 1`, the theoretical film flux diverges; the finite remaining mass, not an invented maximum flux, bounds the update. Pure CO₂ has no carrier diffusion resistance and uses a heat-limited coexistence branch. It does not evaluate the singular logarithm.

The old constant-latent-enthalpy saturation curve is retained explicitly:

```
psat(Ts) = 101325 exp[(Lref MCO₂ / R) (1/Tref − 1/Ts)]
Tref = 194.67 K
```

The extensive backward-Euler energy equation is solved with the mass equation by bracketed bisection in the log carrier depletion `L = ln((1−y∞)/(1−ys))`. The inverse `ys = y∞ + (1−y∞)(1−exp(−L))` supplies surface temperature, while the finite mass flux is evaluated directly from `L`. This avoids failure near saturation when `1−ys` is smaller than floating-point resolution; it introduces no flux cap and does not weaken the caloric acceptance gate.

```
m₁ = m₀ − min(m₀, max(0, ṁ(Ts) Δt))
Qcontact = h A (T∞ − Ts) Δt
eg = hg(Ts) − P/ρs
m₁ us(Ts) + (m₀ − m₁) eg = m₀ us(T₀) + Qheater + Qcontact
```

`eg` is vapor specific enthalpy minus the work of opening the volume previously occupied by solid. The source and surrounding control volumes share that moving interface; using this same transfer with opposite signs preserves their combined internal energy. The surrounding gas volume also grows by `(m₀−m₁)/ρs`. Solid and gas caloric functions are those already defined in `thermodynamics.ts`; temperature-dependent heat capacities remain a model-form gap.

The code records the independent constitutive energy residual, rejects a failed solve, and uses the equivalent energy difference for final transfer to avoid accumulation of floating-point cancellation. This is roundoff closure, not a physical energy source. Heater energy is counted once by the caller. On exhaustion, all remaining input energy is returned to surrounding cells. Area frozen during a step and environmental fields held during the source update make this a first-order time discretization; timestep refinement is required.

## Integration contract

Call `advanceDryIceSource` once per attempted coupled transport step. Compute weighted ambient temperature and total pressure with the same source weights. Compute weighted local **partial** CO₂ pressure and divide by weighted total pressure for the far-field mole fraction. Do not average source temperature into gas inventories.

For each support weight `wᵢ`, apply:

```
Qᵢ = h A wᵢ (Tᵢ − Ts,new) Δt
cellEnergyᵢ += wᵢ emittedEnergyJ − Qᵢ
cellCO2Molesᵢ += wᵢ emittedKg / MCO₂
```

Then set remaining source mass/temperature and update the species source ledger. Any parent-step rejection must restore both source state and cell inventories, as the coupled transport checkpoint already does. No source update is applied from rendering or playback.

## Limits and verification

- Supported source temperature: 150 K to below the 216.58 K triple point. The existing ideal-gas/Darcy pressure interval, 1–300 kPa, is retained. These numerical bounds are broader than the inspected experiment and are not validation bounds.
- No liquid CO₂, nonideal mixture EOS, deposition, frost layers, resolved free gas interface, internal solid conduction, buoyant film flow, fracture-fed contact, or measured buried-source geometry is modeled. Large source lumped temperature needs a Biot-number and internal-gradient study; no such accuracy claim is made.
- `tests/coupledSource.test.ts` checks coexistence-curve inversion, sublimative cooling without external heat, concentration response, a pure-CO₂ analytic heat limit, finite exhaustion, a finite near-saturation flux below floating-point carrier-fraction resolution, an independent total-energy trajectory, first-order timestep convergence, and rejection of unsupported input. These test mathematical behavior and accounting, not agreement with the paper's apparatus.
- The source coefficient and existing constant caloric properties require sensitivity analysis and matched measurements before prediction of field sublimation times or treatment success.

## Search record

27 September 2026: inspected the university-hosted primary PDF above after the prior total-pressure model audit. Focused on experimental conditions, interfacial transport, energy balance, and the distinction between far-field composition and surface equilibrium. This was a targeted primary-source investigation, not an exhaustive literature search or a new experimental dataset.
