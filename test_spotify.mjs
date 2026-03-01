import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load env
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
    const envConfig = readFileSync(envPath, "utf8");
    envConfig.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !line.trim().startsWith("#")) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
            process.env[key] = value;
        }
    });
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

const run = async () => {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        body: "grant_type=client_credentials",
    });

    const payload = await response.json();
    const token = payload.access_token;
    console.log("Got token!", token.substring(0, 10) + "...");

    const playlistId = "37i9dQZF1DX2L0iB23Enbq";
    const tracksRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=6`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );
    console.log("Tracks status:", tracksRes.status);
    console.log(await tracksRes.text());
};
run();
