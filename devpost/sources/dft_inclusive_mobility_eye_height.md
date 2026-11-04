# Wheelchair users' eye height: UK DfT, Inclusive Mobility

- Document: "Inclusive Mobility. A Guide to Best Practice on Access to Pedestrian and Transport Infrastructure" (PDF title), Department for Transport (UK), December 2021 (PDF created 2021-12-06, modified 2021-12-10), 131 pages.
- Publication page: https://www.gov.uk/government/publications/inclusive-mobility-making-transport-accessible-for-passengers-and-pedestrians
- PDF: https://assets.publishing.service.gov.uk/media/61d32bb7d3bf7f1f72b5ffd2/inclusive-mobility-a-guide-to-best-practice-on-access-to-pedestrian-and-transport-infrastructure.pdf
- Where: section 3.3 "Wheelchair users", PDF page 21 (printed page number 21), in the list "Other basic measurements that are of importance when considering design standards for wheelchair users are:".
- Verbatim (bullet text as extracted by pdftotext; the line breaks are the PDF's):

> eye height, which is around 120-130mm below seated height, giving a 5th-95th percentile range for wheelchair users from 960mm to 1250mm (1080mm to 1315mm for mobility scooter users)

- Context on the same page: the figures come from "A comprehensive set of measurements of wheelchair users visiting the Mobility Roadshow (1999)".
- Checked: 2026-11-03 22:16 ET, the PDF downloaded to a scratch folder outside the project (sha256 37bf5cc9dcb98522154e92dfc6431bce60b84760132bea02681a1566d4aa398) and searched as text with pdftotext. The PDF is not in the project; only the numbers and this sentence are used.

## How Glare Zone uses it (G2)

Only the two percentiles: 960 mm (5th) and 1250 mm (95th). `devpost/tools/coverage_estimate.py` fits a normal distribution to them (mean (96 + 125) / 2 = 110.5 cm, sd (125 - 96) / (2 x 1.645) = 8.82 cm). That fit is an assumption made here, not something the guide states: the guide gives the two percentiles only. Every figure computed from it is an estimate and is labelled so.
