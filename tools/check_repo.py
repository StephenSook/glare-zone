"""Repository checks for Glare Zone, run in CI on every push (python3 tools/check_repo.py).

Every check FAILS rather than skips: a missing file is an error, and each scan reports how many files it read.
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LEAF_FLOOR = 12
FAILURES = []


def fail(msg):
    FAILURES.append(msg)
    print("FAIL:", msg)


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode().split("\0") if p]


def leaf_scenarios():
    ids = set()
    files = list((ROOT / "Assets").rglob("*.ts"))
    for f in files:
        ids.update(re.findall(r'id:\s*"(glare-c\d+-[a-z0-9-]+)"', f.read_text(errors="ignore")))
    print(f"LEAF: {len(ids)} scenarios in {len(files)} TypeScript files")
    if len(files) < 20:
        fail(f"read only {len(files)} TypeScript files; expected the whole Assets tree")
    return sorted(ids)


def main():
    files = tracked_files()
    print(f"tracked files: {len(files)}")
    if len(files) < 100:
        fail(f"only {len(files)} tracked files; the scan floor is 100")

    for bad in (".mcp.json", "CLAUDE.local.md", ".claude/settings.local.json", ".env"):
        if any(p == bad or p.endswith("/" + bad) for p in files):
            fail(f"{bad} is tracked; it must stay local")

    scenes = [p for p in files if p.endswith(".scene")]
    if not scenes:
        fail("no .scene file tracked")
    for p in scenes:
        text = (ROOT / p).read_text(errors="ignore")
        if re.search(r'"(?:api_?)?[Tt]oken"\s*:\s*"[^"]{16,}"', text):
            fail(f"{p} contains a saved token; clear it in Lens Studio before pushing")

    ids = leaf_scenarios()
    if len(ids) < LEAF_FLOOR:
        fail(f"{len(ids)} LEAF scenarios, floor is {LEAF_FLOOR}")
    readme = ROOT / "README.md"
    if not readme.exists():
        fail("README.md missing")
    else:
        claimed = re.findall(r"(\d+) LEAF scenarios", readme.read_text())
        if not claimed:
            fail("README.md does not state the LEAF scenario count")
        for c in claimed:
            if int(c) != len(ids):
                fail(f"README claims {c} LEAF scenarios; the code has {len(ids)}")

    docs = [p for p in files if p == "README.md" or (p.startswith("devpost/") and p.endswith(".md"))]
    print(f"em dash scan: {len(docs)} documents")
    for p in docs:
        if "—" in (ROOT / p).read_text(errors="ignore"):
            fail(f"{p} contains an em dash")

    tests = ROOT / "tests" / "glareMath.test.mjs"
    if not tests.exists():
        fail("tests/glareMath.test.mjs missing")
    else:
        n = len(__import__("re").findall(r"^test\(", tests.read_text(), flags=__import__("re").M))
        # Some tests are generated in loops, so the regex count is a floor, not the total.
        # The unit-tests CI job runs them all with node --test; the 32-test total is read from its output.
        print(f"unit test() calls written out: {n}")
        if n < 20:
            fail(f"only {n} test() calls found; floor is 20")

    if FAILURES:
        print(f"\n{len(FAILURES)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


if __name__ == "__main__":
    main()
