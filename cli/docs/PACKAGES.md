# Native packages and release artifacts

The ytconv-v1.7.3 workflow builds artifacts from the same tested source. Availability is determined by the completed GitHub package matrix; do not assume an artifact exists until it is attached to the release.

Expected artifact families:

| Platform | Artifact pattern |
|---|---|
| npm | ytconv-1.7.3.tgz with provenance |
| Windows | YTConv-1.7.3-Setup-x64.exe, portable ZIP |
| Android | debug APK, unsigned release APK, source archive |
| Debian/Ubuntu | ytconv_1.7.3_ARCH.deb |
| Fedora/RHEL/openSUSE | ytconv-1.7.3-1.ARCH.rpm |
| Arch/CachyOS | ytconv-1.7.3-1-ARCH.pkg.tar.zst |
| Alpine | ytconv-1.7.3-r0.apk |
| Linux portable | AppImage and tar.gz/tar.zst archives |
| Snap/Flatpak/Nix | matching workflow artifacts |
| Termux | ytconv_1.7.3_all-termux.deb |
| iSH | verified Python installer and checksum manifest |

Verify the matching SHA-256 manifest before installing an artifact. The Android release APK is unsigned unless the release explicitly says otherwise; Android may require a signing step before general distribution. The current app is the tested native Android implementation. A Flutter migration is not claimed as part of 1.7.3 because no Flutter build was validated by this release gate.

Source and checksums: [GitHub Releases](https://github.com/andhikamarcella/YTConv/releases). npm users should normally run npm install -g ytconv@1.7.3.
