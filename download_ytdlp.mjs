import { createWriteStream } from 'fs';
import { get } from 'https';

const file = createWriteStream("yt-dlp.exe");
const request = get("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close(() => console.log("Download completed."));
  });
});
