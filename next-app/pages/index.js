import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const ReCAPTCHA = dynamic(() => import('react-google-recaptcha'), { ssr: false });

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '').replace(/\/$/, '');
const LEGACY_UI_URL = process.env.NEXT_PUBLIC_LEGACY_UI_URL || '/';

const languageOptions = [
  { value: 'auto', label: 'Deteksi otomatis' },
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'es', label: 'Español' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ar', label: 'العربية' },
  { value: 'ru', label: 'Русский' },
  { value: 'de', label: 'Deutsch' },
];

const formatOptions = [
  { value: 'mp3', label: 'MP3 (320kbps)' },
  { value: 'm4a', label: 'M4A' },
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'aiff', label: 'AIFF' },
  { value: 'alac', label: 'ALAC' },
  { value: 'caf', label: 'CAF' },
  { value: 'ogg', label: 'OGG' },
  { value: 'mp4', label: 'MP4 Video' },
  { value: 'webm', label: 'WEBM Video' },
  { value: 'mkv', label: 'MKV Video' },
];

const backgroundJobFormats = [
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' },
];

function extractYouTubeVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.searchParams.has('v')) {
      const candidate = url.searchParams.get('v');
      if (candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
        return candidate;
      }
    }
    if (url.hostname === 'youtu.be') {
      const pathId = url.pathname.replace(/^\//, '').slice(0, 11);
      if (pathId && /^[a-zA-Z0-9_-]{11}$/.test(pathId)) {
        return pathId;
      }
    }
  } catch (err) {
    // Ignore URL parsing failures; we will fall back to returning null.
  }
  return null;
}

export default function Home() {
  const [convertUrl, setConvertUrl] = useState('');
  const [convertKeyword, setConvertKeyword] = useState('');
  const [convertFormat, setConvertFormat] = useState(formatOptions[0].value);
  const [preferredLang, setPreferredLang] = useState(languageOptions[0].value);
  const [convertState, setConvertState] = useState({ status: 'idle', error: null, result: null });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchState, setSearchState] = useState({ status: 'idle', error: null, results: [] });

  const [jobs, setJobs] = useState([]);
  const [jobState, setJobState] = useState({ status: 'idle', error: null });
  const [jobVideoInput, setJobVideoInput] = useState('');
  const [jobFormat, setJobFormat] = useState(backgroundJobFormats[0].value);
  const [createJobState, setCreateJobState] = useState({ status: 'idle', error: null, jobId: null });
  const recaptchaRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (preferredLang !== 'auto') return;
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).map((l) => String(l || '').toLowerCase());
    const mapLang = (l) => {
      if (l.startsWith('id')) return 'id';
      if (l.startsWith('en')) return 'en';
      if (l.startsWith('es')) return 'es';
      if (l.startsWith('ja')) return 'ja';
      if (l.startsWith('ko')) return 'ko';
      if (l.startsWith('ar')) return 'ar';
      if (l.startsWith('ru')) return 'ru';
      if (l.startsWith('de')) return 'de';
      return null;
    };
    const picked = langs.map(mapLang).find(Boolean);
    if (picked) setPreferredLang(picked);
  }, [preferredLang]);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log(
      '[DEBUG] NEXT_PUBLIC_RECAPTCHA_SITE_KEY in runtime:',
      recaptchaSiteKey || '(undefined)'
    );
    if (!recaptchaSiteKey) {
      console.warn(
        '[captcha] NEXT_PUBLIC_RECAPTCHA_SITE_KEY is missing. reCAPTCHA widgets will not render.'
      );
    }
  }, [recaptchaSiteKey]);

  const getApiBase = () => {
    if (API_BASE) return API_BASE;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  };

  const buildApiUrl = (path) => {
    if (/^https?:/i.test(path)) return path;
    const base = getApiBase();
    if (!base) return path;
    try {
      return new URL(path, base).toString();
    } catch (err) {
      if (path.startsWith('/')) return `${base}${path}`;
      return `${base}/${path}`;
    }
  };

  const fetchJson = async (path, options = {}) => {
    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      const message = payload?.error || payload?.message || `Gagal memuat data (status ${response.status})`;
      const error = new Error(message);
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const handleConvert = async (event) => {
    event.preventDefault();
    if (!convertUrl.trim() && !convertKeyword.trim()) {
      setConvertState({ status: 'error', error: 'Masukkan URL media atau kata kunci.', result: null });
      return;
    }
    setConvertState({ status: 'loading', error: null, result: null });
    const body = {
      url: convertUrl.trim(),
      keyword: convertKeyword.trim() || undefined,
      format: convertFormat,
    };
    if (preferredLang !== 'auto') body.preferredLang = preferredLang;
    try {
      const payload = await fetchJson('/api/convert', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setConvertState({ status: 'success', error: null, result: payload });
    } catch (err) {
      setConvertState({ status: 'error', error: err.message, result: null });
    }
  };

  const convertFromItem = async (item) => {
    const urlCandidate = item.webpageUrl || item.url || '';
    const keywordCandidate = !urlCandidate ? (item.title || item.cleanTitle || '') : '';
    if (!urlCandidate && !keywordCandidate) return;
    setConvertState({ status: 'loading', error: null, result: null });
    const body = {
      url: urlCandidate,
      keyword: keywordCandidate || undefined,
      format: convertFormat,
    };
    if (preferredLang !== 'auto') body.preferredLang = preferredLang;
    try {
      const payload = await fetchJson('/api/convert', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setConvertState({ status: 'success', error: null, result: payload });
    } catch (err) {
      setConvertState({ status: 'error', error: err.message, result: null });
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setSearchState({ status: 'error', error: 'Masukkan judul atau kata kunci video.', results: [] });
      return;
    }
    setSearchState({ status: 'loading', error: null, results: [] });
    const body = {
      query: searchQuery.trim(),
    };
    if (preferredLang !== 'auto') body.preferredLang = preferredLang;
    try {
      const payload = await fetchJson('/api/search', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSearchState({ status: 'success', error: null, results: payload?.results || [] });
    } catch (err) {
      setSearchState({ status: 'error', error: err.message, results: [] });
    }
  };

  const refreshJobs = async () => {
    setJobState({ status: 'loading', error: null });
    try {
      const payload = await fetchJson('/api/background', { method: 'GET' });
      setJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
      setJobState({ status: 'success', error: null });
    } catch (err) {
      setJobState({ status: 'error', error: err.message });
    }
  };

  const handleCreateJob = async (event) => {
    event.preventDefault();
    if (!jobVideoInput.trim()) {
      setCreateJobState({ status: 'error', error: 'Masukkan URL atau ID video terlebih dahulu.', jobId: null });
      return;
    }
    const videoId = extractYouTubeVideoId(jobVideoInput);
    if (!videoId) {
      setCreateJobState({ status: 'error', error: 'Tidak bisa menemukan ID video YouTube yang valid.', jobId: null });
      return;
    }
    if (!recaptchaSiteKey) {
      setCreateJobState({ status: 'error', error: 'Captcha belum dikonfigurasi. Hubungi admin.', jobId: null });
      return;
    }

    setCreateJobState({ status: 'loading', error: null, jobId: null });

    try {
      const widget = recaptchaRef.current;
      if (!widget || typeof widget.executeAsync !== 'function') {
        throw new Error('captcha_unavailable');
      }

      let captchaToken = null;
      try {
        captchaToken = await widget.executeAsync();
      } catch (captchaError) {
        console.error('Captcha execution failed:', captchaError);
      }

      if (!captchaToken) {
        throw new Error('captcha_failed');
      }

      const payload = await fetchJson('/api/create-job', {
        method: 'POST',
        body: JSON.stringify({
          videoId,
          format: jobFormat,
          captchaToken,
        }),
      });

      if (!payload?.jobId) {
        throw new Error('worker_response_invalid');
      }

      setCreateJobState({ status: 'success', error: null, jobId: payload.jobId });
      setJobVideoInput('');
      refreshJobs().catch(() => {});
    } catch (err) {
      console.error('Failed to create background job', err);
      let message = 'Gagal memulai job latar.';
      if (err?.payload?.error) {
        message = err.payload.error;
      } else if (err?.message === 'captcha_unavailable') {
        message = 'Captcha belum siap. Muat ulang halaman kemudian coba lagi.';
      } else if (err?.message === 'captcha_failed') {
        message = 'Verifikasi captcha gagal. Silakan coba lagi.';
      } else if (err?.message === 'worker_response_invalid') {
        message = 'Respons worker tidak valid.';
      } else if (err?.message) {
        message = err.message;
      }
      setCreateJobState({ status: 'error', error: message, jobId: null });
    } finally {
      try {
        recaptchaRef.current?.reset();
      } catch (resetError) {
        // Ignore reset failures.
      }
    }
  };

  useEffect(() => {
    refreshJobs().catch(() => {});
  }, []);

  const absoluteResultUrl = useMemo(() => {
    if (!convertState.result?.downloadUrl) return null;
    const path = convertState.result.downloadUrl;
    if (/^https?:/i.test(path)) return path;
    const base = getApiBase();
    if (!base) return path;
    try {
      return new URL(path, base).toString();
    } catch (err) {
      return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }
  }, [convertState.result]);

  const spotifyPreview = useMemo(() => {
    const result = convertState.result;
    if (!result?.metadata) return { provider: null, embedUrl: null, audioUrl: null };
    const meta = result.metadata;
    const preview = (meta.preview && typeof meta.preview === 'object') ? meta.preview : {};
    const original = (meta.originalSource && typeof meta.originalSource === 'object') ? meta.originalSource : {};
    const provider = (preview.provider || original.type || '').toLowerCase();
    if (provider !== 'spotify') return { provider: null, embedUrl: null, audioUrl: null };
    const embedUrl = preview.embedUrl || original.embedUrl || (original.id ? `https://open.spotify.com/embed/track/${original.id}` : null);
    const audioUrl = preview.url || original.previewUrl || null;
    return { provider: 'spotify', embedUrl, audioUrl };
  }, [convertState.result]);

  return (
    <>
      <Head>
        <title>Media Converter Next.js Interface</title>
        <meta name="description" content="Antarmuka React + Next.js untuk mengonversi YouTube, Spotify, dan SoundCloud." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <nav className="navbar navbar-expand-lg navbar-dark bg-transparent py-3">
        <div className="container">
          <a className="navbar-brand" href="#">
            <span>ytmp3</span>
            <small className="ms-2 text-secondary">Next.js</small>
          </a>
          <div className="d-flex align-items-center gap-2">
            <a className="btn btn-outline-light btn-sm" href={LEGACY_UI_URL}>
              Buka UI klasik
            </a>
            <button type="button" className="btn btn-warning btn-sm" onClick={refreshJobs}>
              Muat ulang job
            </button>
          </div>
        </div>
      </nav>
      <main className="container pb-5">
        <div className="row g-4 align-items-start">
          <div className="col-lg-7">
            <div className="card p-4 h-100">
              <h2 className="section-title">Konversi cepat</h2>
              <p className="text-secondary mb-4">
                Gunakan form ini untuk mengubah URL YouTube, Spotify, atau SoundCloud menjadi audio/video. Kamu bisa memasukkan URL langsung atau kata kunci.
              </p>
              <form className="row g-3" onSubmit={handleConvert}>
                <div className="col-12">
                  <label htmlFor="convert-url" className="form-label">
                    URL Media
                  </label>
                  <input
                    id="convert-url"
                    type="url"
                    className="form-control form-control-lg"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={convertUrl}
                    onChange={(event) => setConvertUrl(event.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="convert-keyword" className="form-label">
                    atau cari berdasarkan judul
                  </label>
                  <input
                    id="convert-keyword"
                    type="text"
                    className="form-control"
                    placeholder="contoh: Tulus Monokrom live"
                    value={convertKeyword}
                    onChange={(event) => setConvertKeyword(event.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label htmlFor="convert-format" className="form-label">
                    Format output
                  </label>
                  <select
                    id="convert-format"
                    className="form-select"
                    value={convertFormat}
                    onChange={(event) => setConvertFormat(event.target.value)}
                  >
                    {formatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="convert-lang" className="form-label">
                    Bahasa metadata
                  </label>
                  <select
                    id="convert-lang"
                    className="form-select"
                    value={preferredLang}
                    onChange={(event) => setPreferredLang(event.target.value)}
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 d-flex align-items-center gap-3">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg px-4"
                    disabled={convertState.status === 'loading'}
                  >
                    {convertState.status === 'loading' ? (
                      <span className="d-flex align-items-center gap-2">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        Memproses...
                      </span>
                    ) : (
                      'Konversi sekarang'
                    )}
                  </button>
                  {convertState.status === 'error' && (
                    <span className="text-danger small">{convertState.error}</span>
                  )}
                  {convertState.status === 'success' && convertState.result?.ok && (
                    <span className="badge-chip text-success">
                      ✓ Berhasil
                    </span>
                  )}
                </div>
              </form>

              {convertState.status === 'success' && convertState.result && (
                <div className="mt-4 result-card">
                  <h3 className="h5 fw-bold mb-3">Hasil konversi</h3>
                  {convertState.result.fileName && (
                    <p className="mb-2">
                      <span className="text-secondary">Nama file:</span> {convertState.result.fileName}
                    </p>
                  )}
                  {convertState.result.metadata?.title && (
                    <p className="mb-2">
                      <span className="text-secondary">Judul:</span> {convertState.result.metadata.title}
                    </p>
                  )}
                  {convertState.result.metadata?.artist && (
                    <p className="mb-2">
                      <span className="text-secondary">Artis:</span> {convertState.result.metadata.artist}
                    </p>
                  )}
                  {spotifyPreview.provider === 'spotify' && (
                    <div className="mt-3">
                      <p className="text-secondary mb-2">Preview Spotify:</p>
                      {spotifyPreview.embedUrl ? (
                        <div className="ratio ratio-16x9">
                          <iframe
                            src={spotifyPreview.embedUrl}
                            title="Spotify preview"
                            allow="autoplay; encrypted-media"
                            style={{ border: 0 }}
                          />
                        </div>
                      ) : spotifyPreview.audioUrl ? (
                        <audio className="w-100" controls preload="none" src={spotifyPreview.audioUrl} />
                      ) : null}
                    </div>
                  )}
                  {absoluteResultUrl && (
                    <a className="btn btn-success btn-lg mt-2" href={absoluteResultUrl}>
                      Unduh hasil ({convertState.result.format?.toUpperCase()})
                    </a>
                  )}
                  {convertState.result.spotifyPreview && (
                    <p className="text-warning small mt-2">
                      Audio diunduh langsung dari preview Spotify (sekitar 30 detik).
                    </p>
                  )}
                  {Array.isArray(convertState.result.ringtones) && convertState.result.ringtones.length > 0 && (
                    <div className="mt-3">
                      <p className="text-secondary mb-2">Varian ringtone:</p>
                      <ul className="list-group">
                        {convertState.result.ringtones.map((tone) => (
                          <li key={tone?.downloadUrl || tone?.label} className="list-group-item bg-transparent text-light border-secondary">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                              <div>
                                <div className="fw-semibold">{tone?.label || tone?.fileName || 'Ringtone'}</div>
                                {tone?.duration && (
                                  <small className="text-secondary">Durasi: {tone.duration}s</small>
                                )}
                              </div>
                              {tone?.downloadUrl && (
                                <a className="btn btn-outline-info btn-sm" href={buildApiUrl(tone.downloadUrl)}>
                                  Unduh
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {convertState.result.logs && (
                    <div className="mt-3">
                      <p className="text-secondary mb-2">Ringkasan log:</p>
                      <pre className="text-light small">{convertState.result.logs}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-5 d-flex flex-column gap-4">
            <div className="card p-4">
              <h2 className="section-title">Cari video</h2>
              <form className="row g-3" onSubmit={handleSearch}>
                <div className="col-12">
                  <label htmlFor="search-query" className="form-label">
                    Kata kunci lagu
                  </label>
                  <input
                    id="search-query"
                    type="text"
                    className="form-control"
                    placeholder="contoh: Tiara Andini live"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <div className="col-12 d-flex align-items-center gap-3">
                  <button
                    type="submit"
                    className="btn btn-outline-primary"
                    disabled={searchState.status === 'loading'}
                  >
                    {searchState.status === 'loading' ? (
                      <span className="d-flex align-items-center gap-2">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        Mencari...
                      </span>
                    ) : (
                      'Tampilkan hasil'
                    )}
                  </button>
                  {searchState.status === 'error' && (
                    <span className="text-danger small">{searchState.error}</span>
                  )}
                </div>
              </form>

              {searchState.status === 'success' && (
                <div className="mt-3">
                  {searchState.results.length === 0 ? (
                    <p className="text-secondary">Tidak ada hasil ditemukan.</p>
                  ) : (
                    <ul className="list-group">
                      {searchState.results.map((item) => (
                        <li key={item.id || item.url} className="list-group-item bg-transparent text-light border-secondary">
                          <div className="d-flex flex-column gap-1">
                            <strong>{item.title || item.cleanTitle}</strong>
                            {item.author && <span className="text-secondary">{item.author}</span>}
                            <div className="d-grid gap-2 d-sm-flex flex-sm-wrap mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success w-100 w-sm-auto flex-fill"
                                onClick={() => {
                                  setConvertUrl(item.webpageUrl || item.url || '');
                                  setConvertKeyword('');
                                }}
                              >
                                Pakai URL ini
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info w-100 w-sm-auto flex-fill"
                                onClick={() => {
                                  setConvertKeyword(item.title || item.cleanTitle || '');
                                  setConvertUrl('');
                                }}
                              >
                                Pakai judul ini
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary w-100 w-sm-auto flex-fill"
                                onClick={() => convertFromItem(item)}
                              >
                                Konversi
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="card p-4">
              <h2 className="section-title">Job latar</h2>
              <p className="text-secondary">
                Pantau progres konversi latar dan unduh file yang sudah siap.
              </p>
              <form className="row g-3 mb-4" onSubmit={handleCreateJob}>
                <div className="col-12">
                  <label htmlFor="background-video" className="form-label">
                    Video YouTube
                  </label>
                  <input
                    id="background-video"
                    type="text"
                    className="form-control"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={jobVideoInput}
                    onChange={(event) => setJobVideoInput(event.target.value)}
                  />
                  <small className="text-secondary d-block mt-1">
                    Masukkan URL atau ID video YouTube yang ingin dikonversi.
                  </small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="background-format" className="form-label">
                    Format audio
                  </label>
                  <select
                    id="background-format"
                    className="form-select"
                    value={jobFormat}
                    onChange={(event) => setJobFormat(event.target.value)}
                  >
                    {backgroundJobFormats.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <button
                    type="submit"
                    className="btn btn-success w-100"
                    disabled={createJobState.status === 'loading'}
                  >
                    {createJobState.status === 'loading' ? (
                      <span className="d-flex align-items-center justify-content-center gap-2">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        Memulai...
                      </span>
                    ) : (
                      'Mulai job latar'
                    )}
                  </button>
                </div>
                {createJobState.status === 'error' && (
                  <div className="col-12">
                    <span className="text-danger small">{createJobState.error}</span>
                  </div>
                )}
                {createJobState.status === 'success' && createJobState.jobId && (
                  <div className="col-12">
                    <span className="text-success small">Job dimulai. ID: {createJobState.jobId}</span>
                  </div>
                )}
              </form>
              {isClient && recaptchaSiteKey ? (
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={recaptchaSiteKey}
                  size="invisible"
                  badge="bottomright"
                />
              ) : (
                !recaptchaSiteKey && (
                  <p className="text-warning small">
                    reCAPTCHA belum dikonfigurasi sehingga job latar tidak dapat dimulai.
                  </p>
                )
              )}
              {jobState.status === 'error' && <div className="alert alert-danger">{jobState.error}</div>}
              {jobState.status === 'loading' && (
                <div className="d-flex align-items-center gap-2 text-secondary">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Memuat data job...
                </div>
              )}
              {jobState.status === 'success' && jobs.length === 0 && (
                <p className="text-secondary mb-0">Belum ada job terbaru.</p>
              )}
              {jobs.length > 0 && (
                <ul className="list-group mt-3">
                  {jobs.map((job) => (
                    <li key={job.id} className="list-group-item bg-transparent text-light border-secondary">
                      <div className="d-flex flex-column gap-1">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <strong>Job #{job.id}</strong>
                          <span className="badge bg-info text-dark">{job.status}</span>
                        </div>
                        {job.result?.fileName && (
                          <span className="text-secondary">{job.result.fileName}</span>
                        )}
                        {job.result?.downloadUrl && (
                          <a className="btn btn-outline-success btn-sm mt-1" href={buildApiUrl(job.result.downloadUrl)}>
                            Unduh hasil
                          </a>
                        )}
                        {job.error && (
                          <span className="text-danger small">{job.error}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <p className="footer-note">
          Antarmuka Next.js ini memakai React dan Bootstrap. Semua endpoint backend lama tetap tersedia sehingga fitur lanjutan di UI klasik tetap dapat digunakan.
        </p>
      </main>
      {isClient && recaptchaSiteKey && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '8px',
            borderRadius: '6px',
          }}
        >
          <ReCAPTCHA
            sitekey={recaptchaSiteKey}
            onChange={(token) => {
              if (token) {
                console.log('[debug captcha] token:', token);
              }
            }}
          />
          <div style={{ color: '#fff', fontSize: '11px', marginTop: '4px' }}>debug captcha mount</div>
        </div>
      )}
    </>
  );
}
