# Checklist rilis YTConv 1.2.3

## Sinkronisasi

```sh
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
node -p "require('./package.json').version"
node ./bin/ytconv.js --version
```

Keduanya harus `1.2.3`.

## Test

```sh
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
node ./bin/ytconv.js --self-test
node ./bin/ytconv.js --shell-info
```

GitHub Actions harus hijau untuk Node 18/20/22, Linux, CMD, PowerShell, headless, package preview, Termux simulation, dan iSH.

## Preview paket

```sh
npm publish --dry-run
npm pack --json
```

Pastikan installer, docs, iSH, src, bin, README, changelog, dan license masuk. Pastikan cookies, `.env`, log pribadi, serta hasil download tidak masuk.

## Pastikan versi belum terbit

```sh
npm view ytconv versions --json
```

## Publish

```sh
npm whoami
npm owner ls ytconv
npm publish --access public
```

Dengan OTP:

```sh
npm publish --access public --otp=123456
```

## Verifikasi

```sh
npm view ytconv version --prefer-online
npm view ytconv@1.2.3 dist.integrity
npm uninstall -g ytconv
npm install -g ytconv@1.2.3 --force
ytconv --version
ytconv --self-test
```

## Uji manual minimum

- CMD: `ytconv.cmd --self-test`.
- PowerShell: `ytconv.cmd --shell-info`.
- SSH/Linux: `ytconv --headless "LINK_SAH"`.
- Batch: `ytconv --batch-file links.txt --continue-on-error`.
- Termux: `ytconv --repair`.
- iSH: `ytconv --diagnose`.
- MP3: thumbnail terpisah, cover, metadata.
- YouTube Music: cover 1:1.

PR #145 tetap open dan tidak di-merge sampai diminta pengguna.
