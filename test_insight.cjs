
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
    console.log(`Running: ${ffmpegPath} ${args.join(' ')}`);
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => stderr += d.toString());
    proc.on("error", (err) => {
        console.error("FFmpeg spawn error:", err);
        resolve(null);
    });
    proc.on("close", (code) => {
      console.log("FFmpeg stderr output:\n", stderr);
      try {
        const iMatch = /Integrated loudness:\s+I:\s+([-\d\.]+)\s+LUFS/.exec(stderr);
        const peakMatch = /True peak:\s+Peak:\s+([-\d\.]+)\s+(dBTP|dBFS)/.exec(stderr);
        const lraMatch = /Loudness range:\s+LRA:\s+([-\d\.]+)\s+LU/.exec(stderr);
        
        if (!iMatch) {
            console.log("Regex failed to match Integrated Loudness");
            return resolve(null);
        }
        
        resolve({
          lufs: parseFloat(iMatch[1]),
          peak: peakMatch ? parseFloat(peakMatch[1]) : null,
          lra: lraMatch ? parseFloat(lraMatch[1]) : null
        });
      } catch (e) {
        console.error("Parse error:", e);
        resolve(null);
      }
    });
  });
};

const generateWaveformData = async (inputPath, points = 100) => {
  if (!inputPath) return [];
  const args = [
    "-nostats",
    "-i", inputPath,
    "-ac", "1",
    "-filter:a", "aresample=20",
    "-map", "0:a",
    "-c:a", "pcm_u8",
    "-f", "data",
    "-"
  ];
  
  return await new Promise((resolve) => {
    console.log(`Running: ${ffmpegPath} ${args.join(' ')}`);
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    
    proc.stdout.on("data", (chunk) => chunks.push(chunk));
    proc.on("error", (err) => {
        console.error("FFmpeg waveform error:", err);
        resolve([]);
    });
    
    proc.on("close", () => {
      const buffer = Buffer.concat(chunks);
      console.log(`Waveform buffer size: ${buffer.length}`);
      if (buffer.length === 0) return resolve([]);
      
      const data = [];
      const step = Math.ceil(buffer.length / points);
      
      for (let i = 0; i < points; i++) {
        let max = 0;
        const start = i * step;
        const end = Math.min(start + step, buffer.length);
        
        for (let j = start; j < end; j++) {
           const val = Math.abs(buffer[j] - 128);
           if (val > max) max = val;
        }
        data.push(parseFloat((max / 128).toFixed(2)));
      }
      resolve(data);
    });
  });
};

const createTestFile = async (filename) => {
    return new Promise((resolve, reject) => {
        const args = [
            '-f', 'lavfi',
            '-i', 'sine=frequency=1000:duration=5',
            '-c:a', 'pcm_s16le',
            filename
        ];
        console.log(`Creating test file: ${ffmpegPath} ${args.join(' ')}`);
        const proc = spawn(ffmpegPath, args);
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Failed to create test file, code ${code}`));
        });
        proc.on('error', reject);
    });
};

(async () => {
    const testFile = path.join(__dirname, 'test_audio.wav');
    try {
        await createTestFile(testFile);
        console.log("Test file created.");
        
        console.log("Testing probeAudioLoudness...");
        const loudness = await probeAudioLoudness(testFile);
        console.log("Loudness result:", loudness);
        
        console.log("Testing generateWaveformData...");
        const waveform = await generateWaveformData(testFile);
        console.log("Waveform result (first 10 points):", waveform.slice(0, 10));
        
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
})();
