"""Compatibility entry point. The maintained 3–5 player suite uses Node Playwright.
Set TESIS_NODE if node is not on PATH; see qa_multiplayer.mjs for options.
"""
import os
import subprocess
from pathlib import Path

if __name__ == '__main__':
    raise SystemExit(subprocess.call([os.environ.get('TESIS_NODE', 'node'),
        str(Path(__file__).with_suffix('.mjs'))]))
