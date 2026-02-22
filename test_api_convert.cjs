const http = require('http');

const payload = JSON.stringify({
  url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  format: "mp3",
  normalize: true
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/convert',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("Status:", res.statusCode);
      if (json.error) {
        console.error("Error:", json.error);
        if (json.logs) console.log("Logs:", json.logs);
      } else {
        console.log("Success!");
        console.log("Audio Insight:", json.audioInsight ? "Present" : "Missing");
        if (json.audioInsight) {
          console.log(JSON.stringify(json.audioInsight, null, 2));
        }
      }
    } catch (e) {
      console.error("Failed to parse response:", data);
    }
  });
});

req.on('error', (e) => {
  console.error("Request error:", e);
});

req.write(payload);
req.end();
