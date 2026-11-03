"""Recompute Glare Zone's final verdict from a pasted Lens Studio Logger export.

The Lens writes one GLARE_LOG line each time a light move ends (Assets/Scripts/GlareMath.ts,
moveLogLine). Each line holds the sequence number, the light, its distance and tilt, each eye
height's zone end, the viewing area's edges, how deep each zone reaches into the viewing area
("-" when it stays outside), and the verdict the Lens showed.

This script reads those lines, keeps the last Lens session (sequence numbers restart at 1 when
the Lens opens), reports any missing sequence numbers, recomputes every verdict with the same
rule the Lens uses, and checks the final one:

    clear  only when every eye height's zone end is a real number and every zone stays
           outside the viewing area (all three "_in_cm" fields are "-");
    glare  otherwise, including any value that is missing or cannot be read ("nan").

Plain Python 3, no dependencies.

    python summarize_session.py export.txt     # a saved Logger export
    python summarize_session.py < export.txt   # or pasted on stdin
    python summarize_session.py --selftest     # built-in sample lines (sample data)

Exit status: 0 when every recomputed verdict matches the logged one, 1 when any differs,
2 when no GLARE_LOG line was found.
"""

import math
import sys

TAG = "GLARE_LOG "
EYES = ("standing", "seated", "child")


def parse(line):
    """The key=value fields after the tag, or None when the line is not a session log line."""
    i = line.find(TAG)
    if i < 0:
        return None
    fields = {}
    for tok in line[i + len(TAG):].split():
        k, sep, v = tok.partition("=")
        if sep and k:
            fields[k] = v
    return fields


def number(text):
    """A finite float, or None when the text is missing, "nan", or not a number."""
    try:
        x = float(text)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def recompute(fields):
    """The verdict from the logged numbers alone, with the reason."""
    for eye in EYES:
        if number(fields.get(eye + "_end_cm")) is None:
            return "glare", eye + " zone end cannot be read (" + str(fields.get(eye + "_end_cm")) + ")"
        inside = fields.get(eye + "_in_cm")
        if inside is None:
            return "glare", eye + " has no viewing-area field"
        if inside != "-":
            depth = number(inside)
            if depth is None:
                return "glare", eye + " viewing-area depth cannot be read (" + inside + ")"
            return "glare", eye + " zone reaches " + format(depth, ".2f") + " cm into the viewing area"
    return "clear", "every zone stays outside the viewing area"


def last_session(rows):
    """The lines from the last Lens session: after the last line whose seq is 1."""
    start = 0
    for i, f in enumerate(rows):
        if f.get("seq") == "1":
            start = i
    return rows[start:]


def summarize(text, out=sys.stdout):
    rows = [f for f in (parse(line) for line in text.splitlines()) if f is not None]
    if not rows:
        print("No GLARE_LOG lines found.", file=out)
        return 2
    session = last_session(rows)
    print("GLARE_LOG lines read: %d; last Lens session: %d" % (len(rows), len(session)), file=out)

    seqs = [int(f["seq"]) for f in session if f.get("seq", "").isdigit()]
    expected = list(range(seqs[0], seqs[0] + len(seqs))) if seqs else []
    if seqs != expected:
        missing = sorted(set(range(min(seqs), max(seqs) + 1)) - set(seqs)) if seqs else []
        print("Sequence numbers not consecutive; missing: %s" % (missing or "out of order"), file=out)
    else:
        print("Sequence numbers %d to %d, none missing" % (seqs[0], seqs[-1]), file=out)

    mismatches = 0
    print("", file=out)
    print("seq  light  distance   " + "  ".join("%-9s" % e for e in EYES) + "  logged  recomputed", file=out)
    for f in session:
        mine, _ = recompute(f)
        logged = f.get("verdict", "?")
        flag = "" if mine == logged else "  MISMATCH"
        if flag:
            mismatches += 1
        ends = "  ".join("%-9s" % f.get(e + "_end_cm", "?") for e in EYES)
        print("%-4s %-6s %-10s %s  %-7s %s%s" % (f.get("seq", "?"), f.get("light", "?"),
              f.get("distance_cm", "?"), ends, logged, mine, flag), file=out)

    final = session[-1]
    verdict, reason = recompute(final)
    print("", file=out)
    print("Viewing area: %s to %s cm from the wall" % (final.get("viewing_near_cm", "?"), final.get("viewing_far_cm", "?")), file=out)
    print("Final verdict (recomputed): %s (%s)" % (verdict.upper(), reason), file=out)
    print("Final verdict (logged by the Lens): %s" % final.get("verdict", "?").upper(), file=out)
    if mismatches:
        print("%d line(s) where the recomputed verdict differs from the logged one." % mismatches, file=out)
        return 1
    print("Every logged verdict matches the recomputed one.", file=out)
    return 0


# Sample data for --selftest only (not from a real session): two Lens sessions. The second
# starts at the standard placement (glare), moves the left light in to 60 cm (the right light
# still reaches the area, so glare), then the right light too (both at 60 cm: clear).
SAMPLE = """\
12:00:01 [Assets/Scripts/GlareZoneController.ts:600] GLARE_LOG seq=1 light=R distance_cm=70.00 tilt_deg=32.35 standing_end_cm=28.00 seated_end_cm=63.70 child_end_cm=67.20 viewing_near_cm=60.00 viewing_far_cm=182.00 standing_in_cm=- seated_in_cm=3.70 child_in_cm=7.20 verdict=glare
12:05:00 Lens Opened: v0.4
12:05:10 [Assets/Scripts/GlareZoneController.ts:600] GLARE_LOG seq=1 light=R distance_cm=80.78 tilt_deg=32.35 standing_end_cm=32.31 seated_end_cm=73.51 child_end_cm=77.55 viewing_near_cm=60.00 viewing_far_cm=182.00 standing_in_cm=- seated_in_cm=13.51 child_in_cm=17.55 verdict=glare
12:05:20 [Assets/Scripts/GlareZoneController.ts:600] GLARE_LOG seq=2 light=L distance_cm=60.00 tilt_deg=32.35 standing_end_cm=32.31 seated_end_cm=73.51 child_end_cm=77.55 viewing_near_cm=60.00 viewing_far_cm=182.00 standing_in_cm=- seated_in_cm=13.51 child_in_cm=17.55 verdict=glare
12:05:30 [Assets/Scripts/GlareZoneController.ts:600] GLARE_LOG seq=3 light=R distance_cm=60.00 tilt_deg=32.35 standing_end_cm=24.00 seated_end_cm=54.60 child_end_cm=57.60 viewing_near_cm=60.00 viewing_far_cm=182.00 standing_in_cm=- seated_in_cm=- child_in_cm=- verdict=clear
"""


def selftest():
    import io

    buf = io.StringIO()
    assert summarize(SAMPLE, buf) == 0, buf.getvalue()
    text = buf.getvalue()
    assert "last Lens session: 3" in text, text
    assert "Final verdict (recomputed): CLEAR" in text, text
    # A logged "clear" beside a zone that reaches into the area is caught.
    bad = SAMPLE.replace("seated_in_cm=- child_in_cm=- verdict=clear", "seated_in_cm=0.40 child_in_cm=- verdict=clear")
    assert summarize(bad, io.StringIO()) == 1
    # A value that cannot be computed recomputes as glare, never clear.
    nan = SAMPLE.replace("child_end_cm=57.60", "child_end_cm=nan")
    buf = io.StringIO()
    assert summarize(nan, buf) == 1 and "Final verdict (recomputed): GLARE" in buf.getvalue()
    # A missing line shows as a gap.
    gap = SAMPLE + SAMPLE.splitlines()[-1].replace("seq=3", "seq=5") + "\n"
    buf = io.StringIO()
    summarize(gap, buf)
    assert "missing: [4]" in buf.getvalue(), buf.getvalue()
    assert summarize("Lens Opened: v0.4\n", io.StringIO()) == 2
    print("selftest passed (6 checks, sample data)")
    return 0


def main(argv):
    if "--selftest" in argv:
        return selftest()
    paths = [a for a in argv[1:] if not a.startswith("--")]
    if paths:
        text = ""
        for p in paths:
            with open(p, encoding="utf-8", errors="replace") as fh:
                text += fh.read() + "\n"
    else:
        text = sys.stdin.read()
    return summarize(text)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
