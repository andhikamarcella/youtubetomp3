# download_audio.py — helper for PyTube audio download
import sys, os
from pytube import YouTube

def main():
    if len(sys.argv) < 4:
        print("usage: python3 download_audio.py <url> <out_dir> <out_basename>", file=sys.stderr)
        sys.exit(2)
    url, out_dir, out_basename = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out_dir, exist_ok=True)

    yt = YouTube(url)
    # pick highest abr audio-only stream
    stream = (
        yt.streams
          .filter(only_audio=True)
          .order_by('abr')
          .desc()
          .first()
    )

    if not stream:
        print("no audio stream found", file=sys.stderr)
        sys.exit(3)

    # let PyTube set correct extension (webm/m4a) — keep basename consistent
    filename = out_basename  # pytube adds proper extension
    out_path = stream.download(output_path=out_dir, filename=filename)
    # print absolute path for Node to read
    print(out_path)

if __name__ == "__main__":
    main()
