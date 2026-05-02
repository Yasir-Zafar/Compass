{
  description = "SmartSales ML Service - Nix Development Environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {
    self,
    nixpkgs,
  }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};

    # Python 3.12 is a solid choice for this stack
    python = pkgs.python312;

    # System dependencies required by your specific ML libraries
    buildDeps = with pkgs; [
      stdenv.cc.cc.lib
      zlib
      libpqxx
      postgresql
      libsndfile
      ffmpeg
      glib
      libGL
    ];
  in {
    devShells.${system}.default = pkgs.mkShell {
      buildInputs =
        [
          python
          pkgs.uv
        ]
        ++ buildDeps;

      # This is crucial for libraries like OpenCV and Scikit-learn to find system C++ libs
      LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath buildDeps;
      shellHook = ''
        export PYTHONPATH=$PWD
        # Added zlib and ensured pathing is robust
        export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath (buildDeps ++ [pkgs.zlib])}:$LD_LIBRARY_PATH"

        if [ ! -d .venv ]; then
          echo "Creating virtual environment..."
          uv venv .venv
          source .venv/bin/activate

          # This is the critical line:
          echo "Installing core legacy compatibility..."
          uv pip install "setuptools<71" packaging wheel

          echo "Installing ML dependencies..."
          uv pip install \
            "fastapi==0.111.0" \
            "uvicorn[standard]==0.29.0" \
            "python-multipart==0.0.9" \
            "librosa==0.10.1" \
            "opencv-python-headless==4.9.0.80" \
            "scikit-learn==1.4.2" \
            "shap==0.45.0" \
            "joblib==1.4.0" \
            "scipy==1.13.0" \
            "numpy==1.26.4" \
            "pandas==2.2.2" \
            "aiofiles==23.2.1" \
            "supabase"
        else
          source .venv/bin/activate
          # Safety check: ensures it's installed even if venv existed
          uv pip install "setuptools<71" packaging --quiet
        fi

        echo "🚀 SmartSales ML Environment Active"
      '';
    };
  };
}
