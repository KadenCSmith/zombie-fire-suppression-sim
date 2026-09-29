# Intervention scheduling package integration

The seven Agent E source files and seven test files were installed from the newer cumulative handoff after their SHA-256 manifest matched every code block. The package models deterministic command schedules, ignition, finite dry-ice and water requests, receipts, and separate mass/energy/work accounting.

Local checks on 2026-09-29: typecheck, lint, 170 targeted tests, 1,107 full-suite tests in 73 files, and production build passed. Lint had non-failing warnings. No live solver, app control, or UI imports this package. It therefore does not change actual injection, water delivery, fire spread, or soil motion in the current app. Physical activation requires accepted-step transaction wiring and conservation review so sources are applied once, with the owning solvers enforcing finite inventories and rollback.
