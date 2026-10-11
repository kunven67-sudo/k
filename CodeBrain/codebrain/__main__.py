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
    if "--build-docs" in sys.argv:  # used by SETUP.bat + in the background
        from codebrain.docs import run_build
        run_build()
        return
    if "--vision-model" in sys.argv:  # used by SETUP.bat
        from codebrain.config import Config
        print(Config()["vision_model"])
        return
    if "--doctor" in sys.argv:  # used by DOCTOR.bat
        from codebrain.doctor import run_doctor
        problems = run_doctor()
        if "--pause" in sys.argv:
            input("\nPress Enter to close...")
        sys.exit(1 if problems else 0)
    if "--download-voice" in sys.argv:  # used by SETUP.bat
        from codebrain.config import Config
        from codebrain.voice import Transcriber, missing_parts
        if missing_parts():
            print("Voice libraries missing:", ", ".join(missing_parts()))
            sys.exit(1)
        print("Downloading the voice model (one time only)...")
        Transcriber(Config()["voice_model"]).load()
        print("Voice ready!")
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
