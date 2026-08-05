# Release Process

YTConv uses semantic versioning and release tags in the form `ytconv-v<version>`.

## Release gate

1. Synchronize every version identity.
2. Run the full npm prepack and platform CI suites.
3. Build exact artifacts.
4. Publish npm through Trusted Publishing with provenance.
5. Verify the published npm version and `latest` tag.
6. Generate SHA-256 manifests and an SBOM.
7. Create the matching GitHub Release.

## Artifact verification

Verify `SHA256SUMS.txt` before execution and prefer artifacts carrying GitHub/npm provenance. A checksum proves byte equality with the manifest; provenance additionally links the artifact to its source workflow.

## Immutability

npm versions are immutable. A broken published version must be corrected with a new patch release rather than overwritten.

## Release ownership

The canonical source repository is `andhikamarcella/YTConv`. Release metadata, issue links, documentation, installer URLs, checksums, and SBOM links must use that repository and the exact release tag.
