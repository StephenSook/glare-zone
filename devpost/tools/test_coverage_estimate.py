"""Unit tests for coverage_estimate.py (G2). Run: python -m unittest devpost/tools/test_coverage_estimate.py

The expected figures are recomputed by hand here from the source's two percentiles (DfT Inclusive
Mobility, 2021, p. 21: 960 mm and 1250 mm) and the side-view reach D x (200 - h) / 100.
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coverage_estimate as ce  # noqa: E402


class FitTests(unittest.TestCase):
    def test_fit_to_the_two_percentiles(self):
        self.assertAlmostEqual(ce.MEAN_CM, 110.5, places=9)
        self.assertAlmostEqual(ce.SD_CM, 8.8154, places=4)  # (125 - 96) / (2 x 1.6449), "8.82"
        # The fit puts the source's percentiles back where they were.
        self.assertAlmostEqual(ce.phi((96 - ce.MEAN_CM) / ce.SD_CM), 0.05, places=9)
        self.assertAlmostEqual(ce.phi((125 - ce.MEAN_CM) / ce.SD_CM), 0.95, places=9)

    def test_phi_known_values(self):
        self.assertAlmostEqual(ce.phi(0.0), 0.5, places=12)
        self.assertAlmostEqual(ce.phi(1.959963984540054), 0.975, places=9)


class ShareTests(unittest.TestCase):
    def test_boundary_eye_by_hand(self):
        # D x (200 - h) / 100 = 60  =>  h = 200 - 6000 / D
        self.assertAlmostEqual(ce.boundary_eye_cm(80.78), 200 - 6000 / 80.78, places=9)
        self.assertAlmostEqual(ce.boundary_eye_cm(62.0), 103.2258, places=4)
        self.assertAlmostEqual(ce.boundary_eye_cm(62.5), 104.0, places=9)  # the child seated limit, 60 / 0.96

    def test_recomputed_figures(self):
        # (setback cm, share %) from the script's table, each recomputed here with math.erf.
        for d, pct in ((80.78, 95.79), (70.0, 66.62), (62.5, 23.05), (62.0, 20.46), (57.69, 5.00)):
            h = 200 - 6000 / d
            z = (h - 110.5) / ((125 - 96) / (2 * 1.6448536269514722))
            by_hand = 50 * (1 + math.erf(z / math.sqrt(2)))
            self.assertAlmostEqual(100 * ce.share_with_glare(d), by_hand, places=9)
            self.assertAlmostEqual(by_hand, pct, delta=0.005, msg=f"{d} cm")

    def test_monotonic(self):
        shares = [ce.share_with_glare(d) for d in (50, 57.69, 62, 70, 80.78, 100)]
        self.assertEqual(shares, sorted(shares))

    def test_readout_words(self):
        self.assertEqual(ce.readout(ce.share_with_glare(80.78)), "About 96% of wheelchair users see glare here (estimate)")
        self.assertEqual(ce.readout(ce.share_with_glare(62.0)), "About 20% of wheelchair users see glare here (estimate)")
        self.assertEqual(ce.readout(0.001), "Under 1% of wheelchair users see glare here (estimate)")
        self.assertEqual(ce.readout(0.999), "Over 99% of wheelchair users see glare here (estimate)")


if __name__ == "__main__":
    unittest.main()
