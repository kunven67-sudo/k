"""Start CodeBrain.

    python -m codebrain          -> window app
    python -m codebrain --cli    -> hacker terminal mode
"""

import sys


def main():
    if "--pick-model" in sys.argv:  # used by SETUP.bat
        from codebrain.config import Config
        print(Config()["model"])
        return
    if "--cli" in sys.argv or "--terminal" in sys.argv:
        from codebrain.cli import run_cli
        run_cli()
    else:
        try:
            from codebrain.gui import run_gui
        except ImportError as e:  # tkinter missing -> fall back to terminal
            print(f"Window mode not available ({e}). Starting terminal mode...")
            from codebrain.cli import run_cli
            run_cli()
            return
        run_gui()


if __name__ == "__main__":
    main()
