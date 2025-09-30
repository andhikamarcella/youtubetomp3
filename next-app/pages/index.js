import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '').replace(/\/$/, '');
const LEGACY_UI_URL = process.env.NEXT_PUBLIC_LEGACY_UI_URL || '/';

const languageOptions = [
  { value: 'auto', label: 'Deteksi otomatis' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
];

const formatOptions = [
  { value: 'mp3', label: 'MP3 (320kbps)' },
  { value: 'm4a', label: 'M4A' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'ogg', label: 'OGG' },
  { value: 'mp4', label: 'MP4 Video' },
  { value: 'webm', label: 'WEBM Video' },
  { value: 'mkv', label: 'MKV Video' },
];

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
      setConvertState({ status: 'error', error: 'Masukkan URL YouTube atau kata kunci.', result: null });
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

  return (
    <>
      <Head>
        <title>YouTube to MP3 Next.js Interface</title>
        <meta name="description" content="Antarmuka React + Next.js untuk converter YouTube ke MP3." />
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
                Gunakan form ini untuk mengubah video YouTube menjadi audio. Kamu bisa memasukkan URL langsung atau kata kunci.
              </p>
              <form className="row g-3" onSubmit={handleConvert}>
                <div className="col-12">
                  <label htmlFor="convert-url" className="form-label">
                    URL YouTube
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
                  {absoluteResultUrl && (
                    <a className="btn btn-success btn-lg mt-2" href={absoluteResultUrl}>
                      Unduh hasil ({convertState.result.format?.toUpperCase()})
                    </a>
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
                    Kata kunci YouTube
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
                            <div className="d-flex flex-wrap gap-2 mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => {
                                  setConvertUrl(item.webpageUrl || item.url || '');
                                  setConvertKeyword('');
                                }}
                              >
                                Pakai URL ini
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info"
                                onClick={() => {
                                  setConvertKeyword(item.title || item.cleanTitle || '');
                                  setConvertUrl('');
                                }}
                              >
                                Pakai judul ini
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
    </>
  );
}
