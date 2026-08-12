{
  description = "YTConv 1.7.3 secure social-media downloader and converter CLI";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = function:
        nixpkgs.lib.genAttrs systems (system: function (import nixpkgs { inherit system; }));
    in {
      packages = forAllSystems (pkgs: {
        ytconv = pkgs.callPackage ./packaging/nix/ytconv.nix { };
        default = self.packages.${pkgs.system}.ytconv;
      });

      apps = forAllSystems (pkgs: {
        ytconv = {
          type = "app";
          program = "${self.packages.${pkgs.system}.ytconv}/bin/ytconv";
        };
        default = self.apps.${pkgs.system}.ytconv;
      });
    };
}
