"""Runs every offline test (tests/test_*.py) and prints one summary line each.

    python tests/run_all.py

Offline only: no search API calls, no DB writes, no website fetches. The eval_*.py scripts
fetch live sites and are run on their own.
"""

import subprocess
import sys
from pathlib import Path

# A Korean Windows console defaults to cp949, which can't print the Japanese/accented names.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    failed = []
    for test in sorted((ROOT / "tests").glob("test_*.py")):
        proc = subprocess.run(
            [sys.executable, str(test)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        lines = [line for line in proc.stdout.splitlines() if line.strip()]
        passed = [line for line in lines if "passed" in line]
        summary = (passed or lines or ["(no output)"])[-1]
        print(f"{'ok  ' if proc.returncode == 0 else 'FAIL'} {test.name:28} {summary}")
        if proc.returncode != 0:
            failed.append(test.name)
            for line in proc.stdout.splitlines() + proc.stderr.splitlines():
                if "FAIL" in line or "Error" in line or "Traceback" in line:
                    print(f"       {line}")
    print(f"\n{'all passed' if not failed else f'{len(failed)} failed: ' + ', '.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
