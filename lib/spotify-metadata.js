// lib/spotify-metadata.js
// Use Spotify Web API to extract metadata only (no download)
// Mirrors the behavior of the Go SpotifyMetadataClient

// Spotify API credentials - bisa dari environment atau hardcoded
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "0e9faaf2f433479b93e2b3e4a385bc25";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "5e69f3bccc5e41a1ac548278132fdfe5";

let accessTokenCache = { token: null, expiresAt: 0 };

/**
 * Get Spotify access token using client credentials
 * Includes retry logic for rate limiting
 */
const getAccessToken = async () => {
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify API credentials not configured (SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required)");
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  
  let retries = 3;
  while (retries > 0) {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: "grant_type=client_credentials",
    });

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
      retries--;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Spotify API auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s buffer
    };

    return accessTokenCache.token;
  }

  throw new Error("Failed to get access token after retries");
};

/**
 * Extract track ID from Spotify URL
 * Supports multiple URL formats: spotify:track:, open.spotify.com, embed.spotify.com, etc.
 */
const extractTrackId = (url) => {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  // Handle spotify:track: format
  const direct = /spotify:track:([0-9A-Za-z]{22})/i.exec(trimmed);
  if (direct) return direct[1];
  
  try {
    const urlObj = new URL(trimmed);
    
    // Handle embed.spotify.com
    if (urlObj.host === "embed.spotify.com") {
      const uri = urlObj.searchParams.get("uri");
      if (uri) {
        const embedMatch = /spotify:track:([0-9A-Za-z]{22})/i.exec(uri);
        if (embedMatch) return embedMatch[1];
      }
    }
    
    // Handle open.spotify.com or play.spotify.com
    if (urlObj.host === "open.spotify.com" || urlObj.host === "play.spotify.com") {
      const parts = urlObj.pathname.split("/").filter(Boolean);
      
      // Remove locale prefix if present
      if (parts[0]?.startsWith("intl-")) {
        parts.shift();
      }
      
      // Remove "embed" if present
      if (parts[0] === "embed") {
        parts.shift();
      }
      
      const trackIdx = parts.findIndex((p) => p.toLowerCase() === "track");
      if (trackIdx >= 0 && parts[trackIdx + 1] && /^[0-9A-Za-z]{22}$/.test(parts[trackIdx + 1])) {
        return parts[trackIdx + 1].split("?")[0]; // Remove query params
      }
      
      const hl = urlObj.searchParams.get("highlight") || urlObj.searchParams.get("uri");
      if (hl) {
        const m = /spotify:track:([0-9A-Za-z]{22})/i.exec(hl);
        if (m) return m[1];
      }
    }
  } catch {
    // Invalid URL format
  }
  
  return null;
};

/**
 * Get base headers for Spotify API requests
 * Mirrors the Go implementation
 */
const getBaseHeaders = () => {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Referer": "https://open.spotify.com/",
    "Origin": "https://open.spotify.com",
  };
};

/**
 * Make API request with retry logic for rate limiting
 */
const makeAPIRequest = async (url, token, retries = 3) => {
  const headers = {
    ...getBaseHeaders(),
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  while (retries > 0) {
    const response = await fetch(url, { headers });

    if (response.status === 429) {
      // Rate limited - wait and retry
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
      retries--;
      continue;
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Spotify track not found");
      }
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  throw new Error("Failed to fetch from Spotify API after retries");
};

/**
 * Join artists array into comma-separated string
 */
const joinArtists = (artists) => {
  if (!Array.isArray(artists) || artists.length === 0) {
    return "";
  }
  return artists
    .map((a) => (typeof a === "string" ? a : a.name || ""))
    .filter(Boolean)
    .join(", ");
};

/**
 * Get best (largest/HD) image URL from images array
 * Spotify API returns images sorted by size (largest first)
 * Returns the largest available image for HD quality
 */
const getFirstImageURL = (images) => {
  if (!Array.isArray(images) || images.length === 0) {
    return "";
  }
  // Spotify API returns images sorted by size (largest first)
  // images[0] is the largest/HD image
  return images[0]?.url || "";
};

/**
 * Extract Spotify track metadata using Spotify Web API
 * Returns comprehensive metadata matching the Go TrackMetadata structure
 * @param {string} spotifyUrl - Spotify track URL
 * @returns {Promise<Object>} Metadata object
 */
export const extractSpotifyMetadata = async (spotifyUrl) => {
  if (!spotifyUrl || typeof spotifyUrl !== "string") {
    throw new Error("Spotify URL is required");
  }

  const trackId = extractTrackId(spotifyUrl);
  if (!trackId) {
    throw new Error("Invalid Spotify track URL format");
  }

  try {
    const token = await getAccessToken();
    const body = await makeAPIRequest(`https://api.spotify.com/v1/tracks/${trackId}`, token);

    // Extract artists
    const artists = joinArtists(body.artists || []);
    const albumArtists = joinArtists(body.album?.artists || []);

    // Extract cover image (HD - largest size)
    // Spotify API returns images sorted by size (largest first): [640x640, 300x300, 64x64]
    const images = Array.isArray(body.album?.images) ? body.album.images : [];
    // images[0] is the largest/HD image (usually 640x640 or larger)
    const cover = images.length > 0 ? (images[0]?.url || "") : "";

    // Extract external URL
    const externalURL = body.external_urls?.spotify || `https://open.spotify.com/track/${body.id || trackId}`;

    // Extract ISRC if available
    const isrc = body.external_ids?.isrc || "";

    // Build search query for YouTube Music: "judul lagu artis audio"
    const searchQuery = `${(body.name || "").trim()} ${(artists || "").trim()} audio`.trim();

    // Return comprehensive metadata matching Go TrackMetadata structure
    return {
      // Core fields
      id: body.id || trackId,
      spotifyId: body.id || trackId,
      title: body.name || "",
      name: body.name || "", // Alias for title
      artist: artists,
      artists: artists, // Alias
      album: body.album?.name || "",
      albumName: body.album?.name || "",
      albumArtist: albumArtists,
      
      // Duration
      duration: Math.round((body.duration_ms || 0) / 1000),
      durationMs: body.duration_ms || 0,
      
      // Images
      cover: cover,
      images: cover, // Alias
      
      // Release info
      releaseDate: body.album?.release_date || "",
      
      // Track info
      trackNumber: body.track_number || 0,
      totalTracks: body.album?.total_tracks || 0,
      discNumber: body.disc_number || 0,
      
      // URLs
      externalURL: externalURL,
      previewUrl: body.preview_url || "",
      embedUrl: `https://open.spotify.com/embed/track/${body.id || trackId}`,
      
      // ISRC
      isrc: isrc,
      
      // Search query for YouTube
      searchQuery: searchQuery,
    };
  } catch (err) {
    const error = new Error(`Failed to fetch Spotify metadata: ${err.message}`);
    error.cause = err;
    throw error;
  }
};
