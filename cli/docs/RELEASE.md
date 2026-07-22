# Checklist rilis npm YTConv

## Sebelum publish

```bash
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
node -p "require('./package.json').version"
npm install
npm run check
npm run check:ish
npm test
npm run test:ish
npm publish --dry-run
npm pack --json
```

Pastikan:

- versi belum pernah diterbitkan;
- `README.md`, `CHANGELOG.md`, folder `docs`, dan frontend `ish` masuk paket;
- GitHub Actions Linux/Windows hijau;
- tidak ada cookies, token, password, atau log privat dalam paket;
- command `--help`, `--version`, `--list-presets`, dan `--json` bekerja.

## Publish

```bash
npm whoami
npm publish --access public
npm view ytconv version --prefer-online
```

## Tes versi publik

```bash
npm uninstall -g ytconv
npm install -g ytconv@1.2.0
ytconv --version
ytconv --diagnose
ytconv --list-presets
```

## Setelah publish

- Jangan mencoba menimpa nomor versi yang sama.
- Simpan PR tetap open bila masih memerlukan pengujian manual.
- Merge hanya setelah pengguna secara eksplisit meminta.
