"""Wheelchair coverage estimate for Glare Zone (G2).

How many wheelchair users would see glare in the viewing area, for a given light setback. This is
an ESTIMATE, built from two published percentiles and an assumed normal distribution:

- Source: UK Department for Transport, "Inclusive Mobility" (December 2021), section 3.3, PDF page
  21: wheelchair users' eye height "from 960mm to 1250mm" (5th to 95th percentile). Verbatim
  sentence and link: devpost/sources/dft_inclusive_mobility_eye_height.md.
- Assumption (not in the source): eye height is normal. Fitted to the two percentiles:
  mean = (96 + 125) / 2 = 110.5 cm, sd = (125 - 96) / (2 x 1.6449) = 8.82 cm.

Geometry (the brief's side-view check; upright glass whose lit part reaches its top, 200 cm, and
a 300 cm ceiling): a light D cm from the wall sends glare to D x (200 - h) / 100 cm for an eye at
h cm. A zone that reaches the viewing area's near edge (60 cm) counts as glare (touching is
inside, as on the answer card). So every eye at or below h* = 200 - near x 100 / D sees glare,
and the share is Phi((h* - mean) / sd).

The Lens computes the same share from its own model (GlareMath.wheelchairGlareShare, which finds
h* on the 3D footprint by bisection); the unit tests hold the two together.

Usage:
    python devpost/tools/coverage_estimate.py            # the table below
    python devpost/tools/coverage_estimate.py 62 70.5    # setbacks of your choice, in cm
    python -m unittest devpost/tools/test_coverage_estimate.py
"""
import math
import sys

P5_CM = 96.0  # 960 mm, 5th percentile (DfT Inclusive Mobility, 2021, p. 21)
P95_CM = 125.0  # 1250 mm, 95th percentile
Z95 = 1.6448536269514722  # the standard normal's 95th percentile

MEAN_CM = (P5_CM + P95_CM) / 2
SD_CM = (P95_CM - P5_CM) / (2 * Z95)

CEILING_CM = 300.0
GLASS_TOP_CM = 200.0
NEAR_EDGE_CM = 60.0


def phi(z: float) -> float:
    """The standard normal cumulative distribution."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def boundary_eye_cm(setback_cm: float, near_cm: float = NEAR_EDGE_CM) -> float:
    """The highest eye height whose zone reaches the near edge: D x (200 - h) / 100 = near."""
    return GLASS_TOP_CM - near_cm * (CEILING_CM - GLASS_TOP_CM) / setback_cm


def share_with_glare(setback_cm: float, near_cm: float = NEAR_EDGE_CM) -> float:
    """Estimated share (0 to 1) of wheelchair users whose eyes see glare in the viewing area."""
    return phi((boundary_eye_cm(setback_cm, near_cm) - MEAN_CM) / SD_CM)


def readout(share: float) -> str:
    """The Lens's words for a share."""
    pct = share * 100.0
    if pct < 0.5:
        return "Under 1% of wheelchair users see glare here (estimate)"
    if pct > 99.5:
        return "Over 99% of wheelchair users see glare here (estimate)"
    # Half up, as the Lens rounds (Math.round), not Python's round-half-to-even.
    return f"About {math.floor(pct + 0.5)}% of wheelchair users see glare here (estimate)"


TABLE_SETBACKS = (80.78, 70.0, 62.5, 62.0, 57.69)


def main(argv):
    setbacks = [float(a) for a in argv] or list(TABLE_SETBACKS)
    print(f"Fit to DfT Inclusive Mobility (2021) p. 21, 5th to 95th percentile {P5_CM:.0f} to {P95_CM:.0f} cm:")
    print(f"  mean {MEAN_CM:.2f} cm, sd {SD_CM:.4f} cm (an assumed normal distribution, an estimate)")
    print(f"Upright glass lit to {GLASS_TOP_CM:.0f} cm, {CEILING_CM:.0f} cm ceiling, viewing area from {NEAR_EDGE_CM:.0f} cm:")
    for d in setbacks:
        h = boundary_eye_cm(d)
        s = share_with_glare(d)
        print(f"  lights {d:6.2f} cm out: glare for eyes at or below {h:7.3f} cm, {100 * s:6.2f}% -> \"{readout(s)}\"")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
