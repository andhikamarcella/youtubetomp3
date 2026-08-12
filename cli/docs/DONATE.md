# Donate — just pay what you can

YTConv is free to use. Donations are optional and do not unlock features, remove limits, change download priority, or affect support.

## Choose a provider

| Provider | Intended audience | Link |
|---|---|---|
| Ko-fi | Global users | [ko-fi.com/cellauu](https://ko-fi.com/cellauu) |
| Saweria | Users in Indonesia | [saweria.co/dhikamarcella](https://saweria.co/dhikamarcella) |

Open the choice menu:

```bash
ytconv donate
```

Or choose a provider directly:

```bash
ytconv donate kofi
ytconv donate saweria
```

In the interactive YTConv home screen, press `N`, then press `1` for Ko-fi or `2` for Saweria.

## What happens after selection

YTConv asks the operating system to open the exact HTTPS donation page in the default browser. It does not process a payment, collect payment details, receive a payment confirmation, or add tracking.

After the browser handoff, the interactive CLI returns to its home screen after five seconds. If the device cannot open a browser, YTConv tries to copy the link to the clipboard and also prints the complete link for manual use. In a non-interactive terminal, the command only prints the link and does not try to launch a browser.

The Ko-fi and Saweria URLs are fixed inside the release. User-provided browser URLs are not accepted by the donation command.

For questions, contact [help.ytconv@proton.me](mailto:help.ytconv@proton.me).
