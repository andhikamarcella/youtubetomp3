{
  lib,
  buildNpmPackage,
  importNpmLock,
  makeWrapper,
  nodejs_24,
  python3,
  ffmpeg,
  yt-dlp,
  gallery-dl,
}:

buildNpmPackage {
  pname = "ytconv";
  version = "1.6.5";
  src = ../..;
  npmRoot = "cli";

  npmDeps = importNpmLock {
    npmRoot = ../../cli;
  };
  npmConfigHook = importNpmLock.npmConfigHook;
  npmFlags = [ "--ignore-scripts" ];
  dontNpmBuild = true;

  nativeBuildInputs = [ makeWrapper ];

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/lib/node_modules/ytconv" "$out/bin"
    cp -a . "$out/lib/node_modules/ytconv/"
    makeWrapper ${nodejs_24}/bin/node "$out/bin/ytconv" \
      --add-flags "$out/lib/node_modules/ytconv/bin/ytconv-auth.js" \
      --prefix PATH : ${lib.makeBinPath [ python3 ffmpeg yt-dlp gallery-dl ]} \
      --set YTCONV_DISTRIBUTION_PACKAGE nix
    "$out/bin/ytconv" --version | grep -Fx 1.6.5
    runHook postInstall
  '';

  meta = {
    description = "Secure YouTube MP4 and MP3 downloader CLI";
    homepage = "https://github.com/andhikamarcella/youtubetomp3";
    license = lib.licenses.isc;
    mainProgram = "ytconv";
    platforms = lib.platforms.linux;
    maintainers = [ ];
  };
}
