# Physics comparison workbook

[Download the Excel workbook](physics-comparison.xlsx).

The workbook compares identifiable repository versions 0.8.0 through 0.16.0 using tagged commits, source files, tests and versioned documentation. It includes a version register, constraint matrix, changes and evidence register, qualitative status-count chart, and tracked test-file chart.

Implementation fidelity and validation status are separate. Status values are `Implemented`, `Partial`, `Approximation`, `Visualization-only`, `Absent`, and `Unknown`. `Unknown` means the reviewed historical record did not establish presence or absence; it is never converted to `Absent` or zero. Replay availability is also separate from source availability.

The charts do not score accuracy. Feature counts and test-file counts describe documented breadth only; they do not measure physical correctness, experimental validity, field-treatment success or confidence. Numerical conservation checks are evidence about software/model accounting, not validation of material properties or outcomes. Future work from [`llm-workpacks`](llm-workpacks/README.md) is excluded from implemented status.

The workbook was generated from baseline `4caaba31bf073fe8c9c2ce3dd793626a6d1d71c3`. It was reopened after export, all five worksheets rendered, formulas scanned for Excel errors, and both chart series checked for the intended source-cell bindings.
