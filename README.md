# MediLink — Clinical Record Viewer

A FHIR R4-compliant Electronic Health Record (EHR) viewer built as a full-stack application. MediLink demonstrates core patterns from modern clinical software: patient-centered data models, structured observations, encounter tracking, and interoperability with external FHIR servers.

## Features

- **Patient dashboard** — summary tiles for active conditions, medications, allergies, and recent encounters
- **Clinical tabs** — conditions, medications, allergies, observations, encounters, and an audit log
- **Vitals chart** — Chart.js dual-axis line chart showing blood pressure trends and heart rate
- **Encounter timeline** — vertical timeline of the last six encounters
- **New encounter entry** — modal form that persists to SQLite and re-renders the record
- **Dual data source** — switch between the local seeded database and live FHIR data pulled from the public HAPI R4 sandbox
- **Audit log** — every API request is persisted with timestamp, path, status, and latency
- **Offline-first** — the app is fully functional with seeded demo data even without an internet connection

## Tech Stack

- **Backend:** Node.js, Express, node:sqlite (built-in)
- **Frontend:** Vanilla JavaScript, Tailwind CSS (CDN), Chart.js (CDN)
- **Interoperability:** HAPI FHIR R4 sandbox proxy (`Patient/{id}/$everything`)
- **Persistence:** SQLite file database (`medilink.db`), auto-created and auto-seeded on first run

## Getting Started

```bash
npm install
node server.js
```

> Requires Node.js 22.5 or newer (the backend uses the built-in `node:sqlite` module).

Then open [http://localhost:3000](http://localhost:3000).

On first launch, the server creates `medilink.db` and seeds it with three demo patients:

| MRN         | Name          | Primary conditions                             |
|-------------|---------------|------------------------------------------------|
| MLK-10294   | Sarah Ahmed   | Type 2 Diabetes, Hypertension, Hyperlipidemia  |
| MLK-10587   | Daniyal Khan  | Asthma, Seasonal Allergic Rhinitis             |
| MLK-10891   | Ayesha Malik  | CHF, Atrial Fibrillation, CKD Stage 3, T2DM    |

## API Reference

| Method | Path                                   | Description                                              |
|--------|----------------------------------------|----------------------------------------------------------|
| GET    | `/api/patients`                        | List patients with summary counts                        |
| GET    | `/api/patients/:id`                    | Full patient detail (patient, conditions, meds, ...)     |
| GET    | `/api/patients/:id/conditions`         | Conditions only                                          |
| GET    | `/api/patients/:id/medications`        | Medications only                                         |
| GET    | `/api/patients/:id/allergies`          | Allergies only                                           |
| GET    | `/api/patients/:id/observations`       | Observations; supports `?type=blood-pressure` etc.       |
| GET    | `/api/patients/:id/encounters`         | Encounters only                                          |
| POST   | `/api/patients/:id/encounters`         | Create a new encounter                                   |
| GET    | `/api/fhir/:fhirId`                    | Proxy to HAPI; normalized to the same shape as detail    |
| GET    | `/api/audit`                           | Last 50 audit log entries                                |

## Live FHIR Mode

Toggle **Live FHIR** in the header, enter a patient ID from the HAPI R4 sandbox (for example `597173` or `609787`), and MediLink fetches `Patient/{id}/$everything`, parses the Bundle server-side, and renders it with the same UI used for the local database.

## Project Structure

```
MediLink/
├── package.json
├── server.js            # Express + SQLite + FHIR proxy
├── public/
│   └── index.html       # Single-page vanilla JS frontend
├── medilink.db          # Created on first run (ignored by git)
└── README.md
```

## Design Notes

- The data model is intentionally close to FHIR resources (`Patient`, `Condition`, `MedicationRequest`, `AllergyIntolerance`, `Observation`, `Encounter`), which makes the HAPI proxy a straight mapping to the same shape the frontend already uses.
- Observations use LOINC codes where appropriate (`85354-9` blood pressure, `8867-4` heart rate, `4548-4` HbA1c, `30934-4` BNP, `29463-7` body weight).
- The audit log demonstrates the kind of lightweight request logging healthcare systems use for traceability.
- The aesthetic is deliberately conservative — white background, slate text, teal accents — to match the visual language of clinical tooling.

## Use Cases Demonstrated

- Electronic Health Record (EHR) viewing
- Revenue Cycle Management (RCM) encounter capture
- Chronic Care Management (CCM) longitudinal observations
- HL7 FHIR R4 interoperability
