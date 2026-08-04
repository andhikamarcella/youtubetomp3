from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"Expected text was not found in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_downloader():
    path = ROOT / "cli/src/downloader.js"
    replace_once(
        path,
        """  formatVideoSelector,\n  isYouTubeMusicUrl,\n  videoContainerArgs,\n""",
        """  formatVideoSelector,\n  isYouTubeMusicUrl,\n  isYouTubeUrl,\n  videoContainerArgs,\n""",
    )
    replace_once(
        path,
        """const MAX_METADATA_BYTES = 12 * 1024 * 1024;\n""",
        """const MAX_METADATA_BYTES = 12 * 1024 * 1024;\nconst PUBLIC_YOUTUBE_RECOVERY_CLIENTS = Object.freeze(['tv_simply', 'web_embedded']);\nconst PUBLIC_YOUTUBE_CHALLENGE = /(?:sign in to confirm.*not a bot|site requires a signed-in account|login[_ ]required)/iu;\n""",
    )
    replace_once(
        path,
        """  const proxy = optionValue(options, 'proxy', 'YTCONV_PROXY');\n  if (proxy) args.push('--proxy', proxy);\n  return args;\n}\n""",
        """  const proxy = optionValue(options, 'proxy', 'YTCONV_PROXY');\n  if (proxy) args.push('--proxy', proxy);\n  const youtubePlayerClient = String(options?.youtubePlayerClient ?? '').trim();\n  if (youtubePlayerClient) {\n    if (!PUBLIC_YOUTUBE_RECOVERY_CLIENTS.includes(youtubePlayerClient)) {\n      throw new Error(`Unsupported internal YouTube public client: ${youtubePlayerClient}`);\n    }\n    args.push('--extractor-args', `youtube:player_client=${youtubePlayerClient}`);\n  }\n  return args;\n}\n\nfunction cookieFree(cookieConfig) {\n  return !cookieConfig || cookieConfig.kind === 'none';\n}\n\nexport function publicYouTubeRecoveryClients({ url, cookieConfig, error } = {}) {\n  const message = error instanceof Error ? error.message : String(error ?? '');\n  if (!isYouTubeUrl(url) || !cookieFree(cookieConfig) || !PUBLIC_YOUTUBE_CHALLENGE.test(message)) return [];\n  return [...PUBLIC_YOUTUBE_RECOVERY_CLIENTS];\n}\n\nasync function withPublicYouTubeRecovery(operation, { url, cookieConfig, onLog } = {}) {\n  try {\n    return await operation('');\n  } catch (primaryError) {\n    const clients = publicYouTubeRecoveryClients({ url, cookieConfig, error: primaryError });\n    if (!clients.length) throw primaryError;\n    const failures = [];\n    for (const client of clients) {\n      onLog?.(`YouTube public access was challenged; retrying without cookies through ${client}...`, true);\n      try {\n        return await operation(client);\n      } catch (error) {\n        failures.push(`${client}: ${error instanceof Error ? error.message : String(error)}`);\n      }\n    }\n    const primary = primaryError instanceof Error ? primaryError.message : String(primaryError);\n    throw new Error(`${primary} Public no-cookie client recovery failed (${failures.join(' | ')}).`);\n  }\n}\n""",
    )
    replace_once(
        path,
        """  try {\n    return await inspectWithYtDlp({ ytDlp, ytDlpPath, url, cookieConfig, playlist, signal, options });\n  } catch (ytDlpError) {\n""",
        """  try {\n    return await withPublicYouTubeRecovery(\n      (youtubePlayerClient) => inspectWithYtDlp({\n        ytDlp, ytDlpPath, url, cookieConfig, playlist, signal,\n        options: youtubePlayerClient ? { ...options, youtubePlayerClient } : options,\n      }),\n      { url, cookieConfig },\n    );\n  } catch (ytDlpError) {\n""",
    )
    replace_once(
        path,
        """  try {\n    return await downloadWithYtDlp({ ytDlp, ytDlpPath, options, onProgress, onLog, signal });\n  } catch (ytDlpError) {\n""",
        """  try {\n    return await withPublicYouTubeRecovery(\n      (youtubePlayerClient) => downloadWithYtDlp({\n        ytDlp, ytDlpPath,\n        options: youtubePlayerClient ? { ...options, youtubePlayerClient } : options,\n        onProgress, onLog, signal,\n      }),\n      { url: options.url, cookieConfig: options.cookieConfig, onLog },\n    );\n  } catch (ytDlpError) {\n""",
    )


def patch_tests():
    path = ROOT / "cli/test/release-1.3.test.js"
    replace_once(
        path,
        """import { buildDownloadArgs } from '../src/downloader.js';\n""",
        """import { buildDownloadArgs, publicYouTubeRecoveryClients } from '../src/downloader.js';\n""",
    )
    marker = """test('subtitle-only downloads subtitles without media payload', () => {\n"""
    addition = """test('public YouTube bot challenges retry only allowlisted no-cookie clients', () => {\n  const clients = publicYouTubeRecoveryClients({\n    url: 'https://www.youtube.com/watch?v=public',\n    cookieConfig: { kind: 'none' },\n    error: new Error('Sign in to confirm you are not a bot'),\n  });\n  assert.deepEqual(clients, ['tv_simply', 'web_embedded']);\n  assert.deepEqual(publicYouTubeRecoveryClients({\n    url: 'https://www.youtube.com/watch?v=private',\n    cookieConfig: { kind: 'browser', spec: 'firefox' },\n    error: new Error('login required'),\n  }), []);\n  assert.deepEqual(publicYouTubeRecoveryClients({\n    url: 'https://example.com/video',\n    cookieConfig: { kind: 'none' },\n    error: new Error('login required'),\n  }), []);\n  assert.deepEqual(publicYouTubeRecoveryClients({\n    url: 'https://www.youtube.com/watch?v=network',\n    cookieConfig: { kind: 'none' },\n    error: new Error('HTTP 503'),\n  }), []);\n});\n\ntest('public YouTube recovery client is emitted as one validated extractor argument', () => {\n  const args = buildDownloadArgs({\n    ...downloadOptions(['--video']),\n    youtubePlayerClient: 'tv_simply',\n  });\n  assert.deepEqual(\n    args.slice(args.indexOf('--extractor-args'), args.indexOf('--extractor-args') + 2),\n    ['--extractor-args', 'youtube:player_client=tv_simply'],\n  );\n  assert.throws(\n    () => buildDownloadArgs({ ...downloadOptions(['--video']), youtubePlayerClient: 'untrusted-client' }),\n    /Unsupported internal YouTube public client/u,\n  );\n});\n\n"""
    replace_once(path, marker, addition + marker)


patch_downloader()
patch_tests()
