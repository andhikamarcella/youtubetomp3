
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

const probeAudioLoudness = async (inputPath) => {
  if (!inputPath) return null;
  const args = [
    "-nostats",
    "-i", inputPath,
    "-map", "a:0",
    "-filter:a", "ebur128=peak=true",
    "-f", "null",
    "-"
  ];
  return await new Promise((resolve) => {
    console.log(`Running probe on ${inputPath}...`);
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => stderr += d.toString());
    proc.on("error", (err) => {
        console.error("FFmpeg probe error:", err);
        resolve(null);
    });
    proc.on("close", (code) => {
      try {
        const iMatch = /Integrated loudness:\s+I:\s+([-\d\.]+)\s+LUFS/.exec(stderr);
        const peakMatch = /True peak:\s+Peak:\s+([-\d\.]+)\s+dBTP/.exec(stderr);
        const lraMatch = /Loudness range:\s+LRA:\s+([-\d\.]+)\s+LU/.exec(stderr);
        
        if (!iMatch) {
            console.log("Probe failed to match. Stderr slice:", stderr.slice(-200));
            return resolve(null);
        }
        
        resolve({
          lufs: parseFloat(iMatch[1]),
          peak: peakMatch ? parseFloat(peakMatch[1]) : null,
          lra: lraMatch ? parseFloat(lraMatch[1]) : null
        });
      } catch (e) {
        console.error("Probe parse error:", e);
        resolve(null);
      }
    });
  });
};

const generateWaveformData = async (inputPath) => {
    if (!inputPath) return [];
    const args = [
      "-nostats",
      "-i", inputPath,
      "-map", "a:0",
      "-filter:a", "aresample=8000,aformat=channel_layouts=mono",
      "-f", "u8",
      "-ac", "1",
      "-ar", "8000",
      "-"
    ];
    return await new Promise((resolve) => {
      console.log(`Running waveform on ${inputPath}...`);
      const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "ignore"] });
      const chunks = [];
      proc.stdout.on("data", (chunk) => chunks.push(chunk));
      proc.on("error", (err) => {
          console.error("FFmpeg waveform error:", err);
          resolve([]);
      });
      proc.on("close", () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
            console.log("Waveform buffer empty");
            return resolve([]);
        }
        
        const data = [];
        const step = Math.ceil(buffer.length / 100);
        for (let i = 0; i < buffer.length; i += step) {
          data.push(buffer[i] / 255);
        }
        resolve(data);
      });
    });
  };

const createTestWav = (filepath) => {
    return new Promise((resolve, reject) => {
        // Generate 1 second of silence/noise
        const args = [
            "-f", "lavfi",
            "-i", "sine=frequency=1000:duration=2",
            "-c:a", "pcm_s16le",
            filepath
        ];
        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Failed to create WAV, code ${code}`));
        });
    });
};

const convertToMp3 = (input, output) => {
    return new Promise((resolve, reject) => {
        const args = ["-i", input, "-c:a", "libmp3lame", output];
        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Failed to convert to MP3, code ${code}`));
        });
    });
};

(async () => {
    const testWav = path.join(__dirname, 'test_source.wav');
    const testMp3 = path.join(__dirname, 'test_output.mp3');
    
    try {
        console.log("Creating test WAV...");
        await createTestWav(testWav);
        
        console.log("Converting to MP3...");
        await convertToMp3(testWav, testMp3);
        
        console.log("Testing MP3...");
        const loudness = await probeAudioLoudness(testMp3);
        console.log("MP3 Loudness:", loudness);
        
        const waveform = await generateWaveformData(testMp3);
        console.log("MP3 Waveform points:", waveform.length);
        
        if (loudness && waveform.length > 0) {
            console.log("SUCCESS: Audio Insight works on MP3");
        } else {
            console.log("FAILURE: Audio Insight failed on MP3");
        }
        
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        if (fs.existsSync(testWav)) fs.unlinkSync(testWav);
        if (fs.existsSync(testMp3)) fs.unlinkSync(testMp3);
    }
})();
