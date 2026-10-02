"""Plot the archived two-second cold-source refinement observations.

Requires matplotlib. Run from anywhere with:
    python scripts/plot-physics-audit.py
The JSON is the recorded solver output; this script does not run a new study.
"""

from pathlib import Path
import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FixedLocator, NullFormatter


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs/review/unified/convergence-study.json"
OUTPUT = ROOT / "docs/figures/convergence-audit.png"
BENCHMARK_OUTPUT = ROOT / "docs/figures/analytical-benchmarks.png"


def main() -> None:
    study = json.loads(DATA.read_text())
    spatial = study["spatial"][:-1]
    temporal = study["temporal"][:-1]
    colors = {"pressure": "#266875", "source": "#ac6034", "time": "#536f47"}

    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 10,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.labelcolor": "#263534", "text.color": "#263534",
        "axes.edgecolor": "#8d9d99", "xtick.color": "#465b56", "ytick.color": "#465b56",
    })
    fig, axes = plt.subplots(1, 3, figsize=(14.2, 5.0))
    fig.patch.set_facecolor("#f6f8f5")
    for ax in axes:
        ax.set_facecolor("#ffffff")
        ax.grid(True, color="#e3e9e5", linewidth=0.7)
        ax.set_axisbelow(True)

    cells = [row["cells"] for row in spatial]
    pressure = [row["pressureRmsErrorPa"] for row in spatial]
    axes[0].plot(cells, pressure, "o-", color=colors["pressure"], linewidth=2.2)
    axes[0].set_xscale("log")
    axes[0].xaxis.set_major_locator(FixedLocator(cells))
    axes[0].set_xticklabels([f"{v:,}" for v in cells], rotation=35, ha="right")
    axes[0].xaxis.set_minor_formatter(NullFormatter())
    axes[0].set_title("A  Global pressure difference")
    axes[0].set_xlabel("Cells (20,480-cell comparator)")
    axes[0].set_ylabel("RMS difference (Pa)")
    axes[0].set_ylim(bottom=0)

    mass = [abs(row["sublimatedRelativeDifferencePercent"]) for row in spatial]
    axes[1].plot(cells, mass, "o-", color=colors["source"], linewidth=2.2)
    axes[1].set_xscale("log")
    axes[1].xaxis.set_major_locator(FixedLocator(cells))
    axes[1].set_xticklabels([f"{v:,}" for v in cells], rotation=35, ha="right")
    axes[1].xaxis.set_minor_formatter(NullFormatter())
    axes[1].set_title("B  Source loss: nonmonotone")
    axes[1].set_xlabel("Cells (20,480-cell comparator)")
    axes[1].set_ylabel("Absolute difference in loss (%)")
    axes[1].set_ylim(bottom=0)

    steps = [row["maxStepS"] for row in temporal]
    temporal_mass = [abs(row["sublimatedRelativeDifferencePercent"]) for row in temporal]
    axes[2].plot(steps, temporal_mass, "o-", color=colors["time"], linewidth=2.2)
    axes[2].set_xscale("log", base=2)
    axes[2].invert_xaxis()
    axes[2].xaxis.set_major_locator(FixedLocator(steps))
    axes[2].set_xticklabels([f"{v:g}" for v in steps])
    axes[2].xaxis.set_minor_formatter(NullFormatter())
    axes[2].set_title("C  Time refinement at 2,560 cells")
    axes[2].set_xlabel("Requested time step (s); 0.0625 s comparator")
    axes[2].set_ylabel("Absolute difference in loss (%)")
    axes[2].set_ylim(bottom=0)

    fig.suptitle("Cold dry-ice source: two-second transport-only numerical comparison", fontsize=13, fontweight="bold")
    fig.subplots_adjust(left=0.055, right=0.985, top=0.80, bottom=0.28, wspace=0.33)
    fig.text(0.5, 0.04,
             "Percentage denominator = comparator's ~0.000154 kg sublimated mass. "
             "The comparator is not exact truth; no experimental or whole-model accuracy is inferred.",
             ha="center", fontsize=9, color="#4c5e59")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUTPUT, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(OUTPUT)

    coupled = json.loads((ROOT / "examples/coupledValidation.json").read_text())
    sensitivity = json.loads((ROOT / "examples/coupledSensitivity.json").read_text())
    heat = sensitivity["thermal"]
    consolidation = coupled["consolidation"][:3]
    fig, axes = plt.subplots(1, 2, figsize=(10.6, 4.3))
    fig.patch.set_facecolor("#f6f8f5")
    for ax in axes:
        ax.set_facecolor("white")
        ax.grid(True, color="#e3e9e5", linewidth=0.7)
        ax.set_axisbelow(True)
        ax.set_xticks([4, 8, 16])
        ax.set_xlabel("Vertical cells")
    axes[0].plot([r["nz"] for r in heat], [r["errorK"] for r in heat], "o-", color=colors["pressure"], linewidth=2.2)
    axes[0].set_title("A  Insulated heat analytical error")
    axes[0].set_ylabel("Maximum temperature error (K)")
    axes[0].set_ylim(bottom=0)
    axes[1].plot([r["nz"] for r in consolidation], [100 * r["relativeAmplitudeError"] for r in consolidation], "o-", color=colors["source"], linewidth=2.2)
    axes[1].set_title("B  Biot consolidation analytical error")
    axes[1].set_ylabel("Pressure amplitude error (%)")
    axes[1].set_ylim(bottom=0)
    fig.suptitle("Separate analytical benchmarks for heat and coupled soil mechanics", fontsize=12, fontweight="bold")
    fig.subplots_adjust(left=0.10, right=0.97, top=0.78, bottom=0.23, wspace=0.28)
    fig.text(0.5, 0.055,
             "Heat: fixed 50 s step. Consolidation: 1, 0.5, 0.25 s steps as the mesh refines; "
             "combined refinement cannot isolate spatial order.",
             ha="center", fontsize=8.4, color="#4c5e59")
    fig.savefig(BENCHMARK_OUTPUT, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(BENCHMARK_OUTPUT)


if __name__ == "__main__":
    main()
