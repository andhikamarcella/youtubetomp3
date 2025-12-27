// lib/spotify-metadata.js
// Use Spotify Web API to extract metadata only (no download)

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

let accessTokenCache = { token: null, expiresAt: 0 };

/**
 * Get Spotify access token using client credentials
 */
const getAccessToken = async () => {
  if (accessTokenCache.token && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify API credentials not configured (SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required)");
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify API auth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s buffer
  };

  return accessTokenCache.token;
};

/**
 * Extract track ID from Spotify URL
 */
const extractTrackId = (url) => {
  if (!url) return null;
  
  // Handle spotify:track: format
  const direct = /spotify:track:([0-9A-Za-z]{22})/i.exec(url);
  if (direct) return direct[1];
  
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    const trackIdx = parts.findIndex((p) => p.toLowerCase() === "track");
    if (trackIdx >= 0 && parts[trackIdx + 1] && /^[0-9A-Za-z]{22}$/.test(parts[trackIdx + 1])) {
      return parts[trackIdx + 1].split("?")[0]; // Remove query params
    }
  } catch {}
  
  return null;
};

/**
 * Extract Spotify track metadata using Spotify Web API
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
    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Spotify track not found");
      }
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const body = await response.json();

    // Extract artists
    const artists = Array.isArray(body.artists)
      ? body.artists.map((a) => a.name).filter(Boolean).join(", ")
      : "";

    // Extract cover image (prefer largest, fallback to first)
    const images = Array.isArray(body.album?.images) ? body.album.images : [];
    const cover = images.length > 0 ? images[0].url : "";

    // Build search query for YouTube
    const searchQuery = `${body.name} ${body.artists[0]?.name || ""} audio`.trim();

    return {
      id: body.id || trackId,
      title: body.name || "",
      artist: artists,
      album: body.album?.name || "",
      duration: Math.round((body.duration_ms || 0) / 1000),
      durationMs: body.duration_ms || 0,
      cover: cover,
      previewUrl: body.preview_url || "",
      embedUrl: `https://open.spotify.com/embed/track/${body.id || trackId}`,
      searchQuery: searchQuery, // For backward compatibility
    };
  } catch (err) {
    const error = new Error(`Failed to fetch Spotify metadata: ${err.message}`);
    error.cause = err;
    throw error;
  }
};
