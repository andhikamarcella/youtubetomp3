# npm dependency and Socket review

YTConv 1.7.4 has an exact allowlisted production dependency set, a committed lockfile, no npm install lifecycle hooks, no telemetry, and no shell-string execution. The release gate runs `npm audit`, supply-chain tests, package-boundary inspection, syntax checks, type checks, and a clean tarball install.

The authoritative controls and reporting path are in [SECURITY.md](../SECURITY.md). Dependency scanners are useful evidence, but no scanner can guarantee zero bugs.
