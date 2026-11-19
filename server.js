// MediLink - FHIR R4 Clinical Record Viewer backend
// Express + Node's built-in node:sqlite. Auto-creates and seeds ./medilink.db on first run.

const express = require('express');
const path = require('path');
const https = require('https');

// node:sqlite is built into Node 22.5+ and stable in Node 23+.
// On Node 22.5-22.x it needs --experimental-sqlite; on Node 23+/24 it does not.
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (err) {
  console.error('\nnode:sqlite is unavailable. Please use Node 22.5+ (with --experimental-sqlite on 22.x) or Node 23+.\n');
  throw err;
}

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'medilink.db');

// ---------- Database setup ----------
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  address TEXT,
  phone TEXT,
  email TEXT
);
CREATE TABLE IF NOT EXISTS conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  onset_date TEXT,
  icd10 TEXT,
  severity TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  route TEXT,
  status TEXT,
  start_date TEXT,
  prescriber TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS allergies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  substance TEXT NOT NULL,
  severity TEXT,
  reaction TEXT,
  status TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  loinc_code TEXT,
  value TEXT,
  unit TEXT,
  effective_date TEXT,
  notes TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS encounters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  encounter_type TEXT,
  provider TEXT,
  reason TEXT,
  notes TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  method TEXT,
  path TEXT,
  status INTEGER,
  duration_ms INTEGER
);
`);

// ---------- Seeding ----------
function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM patients').get();
  if (row.c > 0) return;

  const insertPatient = db.prepare(
    'INSERT INTO patients (mrn, name, gender, dob, address, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertCondition = db.prepare(
    'INSERT INTO conditions (patient_id, name, status, onset_date, icd10, severity) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMed = db.prepare(
    'INSERT INTO medications (patient_id, name, dose, frequency, route, status, start_date, prescriber) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertAllergy = db.prepare(
    'INSERT INTO allergies (patient_id, substance, severity, reaction, status) VALUES (?, ?, ?, ?, ?)'
  );
  const insertObs = db.prepare(
    'INSERT INTO observations (patient_id, type, loinc_code, value, unit, effective_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertEnc = db.prepare(
    'INSERT INTO encounters (patient_id, date, encounter_type, provider, reason, notes) VALUES (?, ?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  try {
    // --- Patient 1: Sarah Ahmed ---
    const p1 = Number(insertPatient.run('MLK-10294', 'Sarah Ahmed', 'female', '1978-04-12',
      'House 12, Street 4, DHA Phase 6, Karachi', '+92-300-1234567', 'sarah.ahmed@example.pk').lastInsertRowid);
    insertCondition.run(p1, 'Type 2 Diabetes Mellitus', 'active', '2019-06-15', 'E11.9', 'moderate');
    insertCondition.run(p1, 'Essential Hypertension', 'active', '2020-02-10', 'I10', 'moderate');
    insertCondition.run(p1, 'Hyperlipidemia', 'active', '2021-11-05', 'E78.5', 'mild');
    insertMed.run(p1, 'Metformin', '500 mg', 'BID', 'oral', 'active', '2019-06-20', 'Dr. Imran Qadir');
    insertMed.run(p1, 'Lisinopril', '10 mg', 'once daily', 'oral', 'active', '2020-02-15', 'Dr. Imran Qadir');
    insertMed.run(p1, 'Atorvastatin', '20 mg', 'nightly', 'oral', 'active', '2021-11-10', 'Dr. Imran Qadir');
    insertAllergy.run(p1, 'Penicillin', 'high', 'Anaphylaxis', 'active');
    insertAllergy.run(p1, 'Shellfish', 'moderate', 'Hives, swelling', 'active');
    const bp1 = [[138,88],[139,88],[140,89],[141,90],[142,90],[142,91],[143,91],[144,91],[144,92],[145,92]];
    const hr1 = [72,74,76,78,80,78,82,80,83,84];
    const bpDates1 = ['2026-05-12','2026-05-28','2026-06-15','2026-07-02','2026-07-20','2026-08-05','2026-08-22','2026-09-10','2026-10-02','2026-10-25'];
    for (let i = 0; i < 10; i++) {
      insertObs.run(p1, 'blood-pressure', '85354-9', `${bp1[i][0]}/${bp1[i][1]}`, 'mmHg', bpDates1[i], 'Clinic reading');
      insertObs.run(p1, 'heart-rate', '8867-4', String(hr1[i]), 'bpm', bpDates1[i], 'Resting');
    }
    const hba1c1 = [[7.2,'2026-03-10'],[7.5,'2026-06-14'],[7.8,'2026-10-02']];
    hba1c1.forEach(([v,d]) => insertObs.run(p1, 'hba1c', '4548-4', String(v), '%', d, 'Lab'));
    const glu1 = [[128,'2026-04-02'],[142,'2026-06-14'],[156,'2026-08-10'],[148,'2026-09-25'],[162,'2026-10-25']];
    glu1.forEach(([v,d]) => insertObs.run(p1, 'fasting-glucose', '1558-6', String(v), 'mg/dL', d, 'Fasting'));
    const enc1 = [
      ['2026-01-18','Office Visit','Dr. Imran Qadir','Diabetes follow-up','HbA1c review, med reconciliation'],
      ['2026-03-10','Office Visit','Dr. Imran Qadir','Routine PCP follow-up','BP elevated, lifestyle counseling'],
      ['2026-05-22','Specialist Consult','Dr. Faiza Rehman','Endocrinology referral','Added insulin plan consideration'],
      ['2026-07-14','Office Visit','Dr. Imran Qadir','Hypertension follow-up','Dose unchanged'],
      ['2026-09-08','Office Visit','Dr. Imran Qadir','Lipid panel review','Statin continued'],
      ['2026-10-25','Office Visit','Dr. Imran Qadir','Chronic care visit','Overall stable']
    ];
    enc1.forEach(e => insertEnc.run(p1, ...e));

    // --- Patient 2: Daniyal Khan ---
    const p2 = Number(insertPatient.run('MLK-10587', 'Daniyal Khan', 'male', '1992-09-30',
      'Flat 7, Gulberg III, Lahore', '+92-321-7654321', 'daniyal.khan@example.pk').lastInsertRowid);
    insertCondition.run(p2, 'Asthma', 'active', '2015-04-10', 'J45.909', 'moderate');
    insertCondition.run(p2, 'Seasonal Allergic Rhinitis', 'active', '2016-03-20', 'J30.2', 'mild');
    insertMed.run(p2, 'Albuterol Inhaler', '90 mcg/puff', 'PRN', 'inhalation', 'active', '2015-04-15', 'Dr. Hassan Ali');
    insertMed.run(p2, 'Fluticasone Nasal Spray', '50 mcg/spray', 'once daily', 'intranasal', 'active', '2016-04-01', 'Dr. Hassan Ali');
    insertAllergy.run(p2, 'Pollen', 'moderate', 'Rhinitis, itchy eyes', 'active');
    insertAllergy.run(p2, 'Dust mites', 'moderate', 'Wheezing', 'active');
    const bp2 = [[118,76],[120,78],[116,74],[119,77],[118,75],[121,78],[117,76],[118,77],[119,76],[120,77]];
    const hr2 = [68,72,70,74,76,72,74,78,70,72];
    const bpDates2 = ['2026-04-05','2026-04-25','2026-05-15','2026-06-10','2026-07-01','2026-07-22','2026-08-14','2026-09-05','2026-09-28','2026-10-20'];
    for (let i = 0; i < 10; i++) {
      insertObs.run(p2, 'blood-pressure', '85354-9', `${bp2[i][0]}/${bp2[i][1]}`, 'mmHg', bpDates2[i], 'Clinic reading');
      insertObs.run(p2, 'heart-rate', '8867-4', String(hr2[i]), 'bpm', bpDates2[i], 'Resting');
    }
    const pf2 = [[450,'2026-04-05'],[420,'2026-06-10'],[380,'2026-07-22'],[410,'2026-09-05'],[440,'2026-10-20']];
    pf2.forEach(([v,d]) => insertObs.run(p2, 'peak-flow', '33452-4', String(v), 'L/min', d, 'Peak expiratory flow'));
    const enc2 = [
      ['2026-02-14','Office Visit','Dr. Hassan Ali','Asthma follow-up','Controlled on current regimen'],
      ['2026-06-10','Office Visit','Dr. Hassan Ali','Allergy season flare','Fluticasone compliance reinforced'],
      ['2026-07-22','Emergency','Dr. ER Staff','Asthma exacerbation','Nebulizer + prednisone taper, discharged'],
      ['2026-10-20','Office Visit','Dr. Hassan Ali','Post-ER follow-up','Action plan updated']
    ];
    enc2.forEach(e => insertEnc.run(p2, ...e));

    // --- Patient 3: Ayesha Malik ---
    const p3 = Number(insertPatient.run('MLK-10891', 'Ayesha Malik', 'female', '1965-11-22',
      'House 44, F-7/2, Islamabad', '+92-333-9988776', 'ayesha.malik@example.pk').lastInsertRowid);
    insertCondition.run(p3, 'Congestive Heart Failure', 'active', '2022-05-18', 'I50.9', 'severe');
    insertCondition.run(p3, 'Atrial Fibrillation', 'active', '2022-05-20', 'I48.91', 'moderate');
    insertCondition.run(p3, 'Chronic Kidney Disease Stage 3', 'active', '2023-01-10', 'N18.3', 'moderate');
    insertCondition.run(p3, 'Type 2 Diabetes Mellitus', 'active', '2018-07-02', 'E11.9', 'moderate');
    insertMed.run(p3, 'Furosemide', '40 mg', 'once daily', 'oral', 'active', '2022-05-20', 'Dr. Nadia Siddiqui');
    insertMed.run(p3, 'Carvedilol', '25 mg', 'BID', 'oral', 'active', '2022-05-20', 'Dr. Nadia Siddiqui');
    insertMed.run(p3, 'Apixaban', '5 mg', 'BID', 'oral', 'active', '2022-05-25', 'Dr. Nadia Siddiqui');
    insertMed.run(p3, 'Metformin', '1000 mg', 'BID', 'oral', 'active', '2018-07-05', 'Dr. Imran Qadir');
    insertMed.run(p3, 'Spironolactone', '25 mg', 'once daily', 'oral', 'active', '2022-06-10', 'Dr. Nadia Siddiqui');
    insertAllergy.run(p3, 'Sulfa drugs', 'high', 'Severe rash', 'active');
    insertAllergy.run(p3, 'Contrast dye', 'moderate', 'Nausea, bronchospasm', 'active');
    const bp3 = [[148,94],[150,94],[152,95],[154,95],[155,96],[156,96],[158,97],[159,97],[160,98],[162,98]];
    const hr3 = [88,92,98,102,95,108,100,105,110,96];
    const bpDates3 = ['2026-02-04','2026-03-12','2026-04-08','2026-05-14','2026-06-18','2026-07-25','2026-08-19','2026-09-14','2026-10-09','2026-11-02'];
    for (let i = 0; i < 10; i++) {
      insertObs.run(p3, 'blood-pressure', '85354-9', `${bp3[i][0]}/${bp3[i][1]}`, 'mmHg', bpDates3[i], 'Clinic reading');
      insertObs.run(p3, 'heart-rate', '8867-4', String(hr3[i]), 'bpm', bpDates3[i], 'Irregular rhythm noted');
    }
    const wt3 = [[72.4,'2026-03-12'],[74.1,'2026-05-14'],[76.8,'2026-07-25'],[73.9,'2026-09-14'],[75.2,'2026-11-02']];
    wt3.forEach(([v,d]) => insertObs.run(p3, 'weight', '29463-7', String(v), 'kg', d, 'Daily home weight'));
    const bnp3 = [[680,'2026-04-08'],[920,'2026-07-25'],[540,'2026-10-09']];
    bnp3.forEach(([v,d]) => insertObs.run(p3, 'bnp', '30934-4', String(v), 'pg/mL', d, 'Elevated'));
    const enc3 = [
      ['2026-01-20','Office Visit','Dr. Nadia Siddiqui','CHF follow-up','Diuretic adjusted'],
      ['2026-03-12','Office Visit','Dr. Nadia Siddiqui','Routine cardiology','EF stable at 35%'],
      ['2026-04-08','Hospitalization','Dr. Nadia Siddiqui','CHF decompensation','Admitted 4 days, IV diuresis'],
      ['2026-06-18','Office Visit','Dr. Nadia Siddiqui','Post-discharge follow-up','Stable, med reconciliation'],
      ['2026-07-25','Hospitalization','Dr. Nadia Siddiqui','CHF decompensation','Admitted 3 days'],
      ['2026-09-14','Office Visit','Dr. Nadia Siddiqui','CKD + CHF review','Nephrology coordination'],
      ['2026-10-09','Specialist Consult','Dr. Tariq Mahmood','Nephrology consult','CKD stage 3, monitoring'],
      ['2026-11-02','Office Visit','Dr. Nadia Siddiqui','Chronic care visit','Overall stable this month']
    ];
    enc3.forEach(e => insertEnc.run(p3, ...e));
    db.exec('COMMIT');
    console.log('Seeded database with 3 demo patients.');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
seedIfEmpty();

// ---------- Middleware ----------
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Audit logging
const insertAudit = db.prepare(
  'INSERT INTO audit_log (timestamp, method, path, status, duration_ms) VALUES (?, ?, ?, ?, ?)'
);
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      try {
        insertAudit.run(new Date().toISOString(), req.method, req.path, res.statusCode, Date.now() - start);
      } catch (e) { /* non-fatal */ }
    }
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function buildPatientDetail(id) {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!patient) return null;
  const conditions = db.prepare('SELECT * FROM conditions WHERE patient_id = ? ORDER BY onset_date DESC').all(id);
  const medications = db.prepare('SELECT * FROM medications WHERE patient_id = ? ORDER BY start_date DESC').all(id);
  const allergies = db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(id);
  const observations = db.prepare('SELECT * FROM observations WHERE patient_id = ? ORDER BY effective_date ASC').all(id);
  const encounters = db.prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY date DESC').all(id);
  return { patient, conditions, medications, allergies, observations, encounters };
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// ---------- API ----------
app.get('/api/patients', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM conditions c WHERE c.patient_id = p.id AND c.status='active') AS active_conditions,
        (SELECT COUNT(*) FROM medications m WHERE m.patient_id = p.id AND m.status='active') AS active_medications,
        (SELECT COUNT(*) FROM allergies a WHERE a.patient_id = p.id) AS allergies_count,
        (SELECT COUNT(*) FROM encounters e WHERE e.patient_id = p.id) AS encounters_count
      FROM patients p ORDER BY p.name
    `).all();
    const withAge = rows.map(r => ({ ...r, age: ageFromDob(r.dob) }));
    res.json(withAge);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/patients/:id', (req, res) => {
  const detail = buildPatientDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: 'Patient not found' });
  detail.patient.age = ageFromDob(detail.patient.dob);
  res.json(detail);
});

app.get('/api/patients/:id/conditions', (req, res) => {
  res.json(db.prepare('SELECT * FROM conditions WHERE patient_id = ?').all(Number(req.params.id)));
});
app.get('/api/patients/:id/medications', (req, res) => {
  res.json(db.prepare('SELECT * FROM medications WHERE patient_id = ?').all(Number(req.params.id)));
});
app.get('/api/patients/:id/allergies', (req, res) => {
  res.json(db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(Number(req.params.id)));
});
app.get('/api/patients/:id/observations', (req, res) => {
  const { type } = req.query;
  const pid = Number(req.params.id);
  if (type) {
    res.json(db.prepare('SELECT * FROM observations WHERE patient_id = ? AND type = ? ORDER BY effective_date ASC').all(pid, type));
  } else {
    res.json(db.prepare('SELECT * FROM observations WHERE patient_id = ? ORDER BY effective_date ASC').all(pid));
  }
});
app.get('/api/patients/:id/encounters', (req, res) => {
  res.json(db.prepare('SELECT * FROM encounters WHERE patient_id = ?').all(Number(req.params.id)));
});

app.post('/api/patients/:id/encounters', (req, res) => {
  const { date, type, provider, reason, notes } = req.body || {};
  if (!date || !type) return res.status(400).json({ error: 'date and type are required' });
  try {
    const info = db.prepare(
      'INSERT INTO encounters (patient_id, date, encounter_type, provider, reason, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(Number(req.params.id), date, type, provider || '', reason || '', notes || '');
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/audit', (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50').all());
});

// ---------- FHIR proxy ----------
function fetchHapi(urlStr, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, { headers: { Accept: 'application/fhir+json' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume();
        return fetchHapi(r.headers.location, timeoutMs).then(resolve, reject);
      }
      if (r.statusCode >= 400) {
        r.resume();
        return reject(new Error(`Upstream ${r.statusCode}`));
      }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('Invalid FHIR JSON')); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('Upstream timeout')); });
    req.on('error', reject);
  });
}

function humanName(n) {
  if (!n || !n.length) return 'Unknown';
  const given = (n[0].given || []).join(' ');
  return `${given} ${n[0].family || ''}`.trim();
}
function addrStr(a) {
  if (!a || !a.length) return '';
  const x = a[0];
  return [(x.line||[]).join(' '), x.city, x.state, x.postalCode, x.country].filter(Boolean).join(', ');
}
function telecomOf(p, system) {
  const t = (p.telecom || []).find(t => t.system === system);
  return t ? t.value : '';
}

app.get('/api/fhir/:fhirId', async (req, res) => {
  const id = req.params.fhirId;
  try {
    const [patientRes, everything] = await Promise.all([
      fetchHapi(`https://hapi.fhir.org/baseR4/Patient/${id}`),
      fetchHapi(`https://hapi.fhir.org/baseR4/Patient/${id}/$everything?_count=200`)
    ]);
    const entries = (everything.entry || []).map(e => e.resource).filter(Boolean);

    const patient = {
      id: patientRes.id,
      mrn: patientRes.id,
      name: humanName(patientRes.name),
      gender: patientRes.gender || 'unknown',
      dob: patientRes.birthDate || null,
      address: addrStr(patientRes.address),
      phone: telecomOf(patientRes, 'phone'),
      email: telecomOf(patientRes, 'email'),
      age: ageFromDob(patientRes.birthDate)
    };

    const conditions = entries.filter(r => r.resourceType === 'Condition').map((c, i) => ({
      id: c.id || i,
      name: (c.code && (c.code.text || (c.code.coding && c.code.coding[0] && c.code.coding[0].display))) || 'Condition',
      status: (c.clinicalStatus && c.clinicalStatus.coding && c.clinicalStatus.coding[0] && c.clinicalStatus.coding[0].code) || 'unknown',
      onset_date: c.onsetDateTime || c.recordedDate || '',
      icd10: (c.code && c.code.coding && c.code.coding[0] && c.code.coding[0].code) || '',
      severity: (c.severity && c.severity.text) || ''
    }));

    const medications = entries.filter(r => r.resourceType === 'MedicationRequest' || r.resourceType === 'MedicationStatement').map((m, i) => ({
      id: m.id || i,
      name: (m.medicationCodeableConcept && (m.medicationCodeableConcept.text ||
        (m.medicationCodeableConcept.coding && m.medicationCodeableConcept.coding[0] && m.medicationCodeableConcept.coding[0].display))) || 'Medication',
      dose: (m.dosageInstruction && m.dosageInstruction[0] && m.dosageInstruction[0].text) || '',
      frequency: '',
      route: '',
      status: m.status || 'unknown',
      start_date: (m.authoredOn || (m.effectivePeriod && m.effectivePeriod.start)) || '',
      prescriber: (m.requester && m.requester.display) || ''
    }));

    const allergies = entries.filter(r => r.resourceType === 'AllergyIntolerance').map((a, i) => ({
      id: a.id || i,
      substance: (a.code && (a.code.text || (a.code.coding && a.code.coding[0] && a.code.coding[0].display))) || 'Unknown',
      severity: (a.reaction && a.reaction[0] && a.reaction[0].severity) || '',
      reaction: (a.reaction && a.reaction[0] && a.reaction[0].manifestation && a.reaction[0].manifestation[0] && a.reaction[0].manifestation[0].text) || '',
      status: (a.clinicalStatus && a.clinicalStatus.coding && a.clinicalStatus.coding[0] && a.clinicalStatus.coding[0].code) || 'active'
    }));

    const observations = entries.filter(r => r.resourceType === 'Observation').map((o, i) => {
      const code = (o.code && o.code.coding && o.code.coding[0]) || {};
      const display = (o.code && o.code.text) || code.display || '';
      let type = 'other', value = '', unit = '';
      if (/blood pressure/i.test(display) || code.code === '85354-9') {
        type = 'blood-pressure';
        const sys = (o.component || []).find(c => /8480/.test((c.code && c.code.coding && c.code.coding[0] && c.code.coding[0].code) || ''));
        const dia = (o.component || []).find(c => /8462/.test((c.code && c.code.coding && c.code.coding[0] && c.code.coding[0].code) || ''));
        value = `${sys && sys.valueQuantity ? sys.valueQuantity.value : '?'}/${dia && dia.valueQuantity ? dia.valueQuantity.value : '?'}`;
        unit = 'mmHg';
      } else if (/heart rate/i.test(display) || code.code === '8867-4') {
        type = 'heart-rate';
        value = String((o.valueQuantity && o.valueQuantity.value) || '');
        unit = 'bpm';
      } else if (/hba1c/i.test(display) || code.code === '4548-4') {
        type = 'hba1c';
        value = String((o.valueQuantity && o.valueQuantity.value) || '');
        unit = '%';
      } else {
        value = (o.valueQuantity && String(o.valueQuantity.value)) || (o.valueString || '');
        unit = (o.valueQuantity && o.valueQuantity.unit) || '';
      }
      return {
        id: o.id || i, type, loinc_code: code.code || '',
        value, unit,
        effective_date: o.effectiveDateTime || o.issued || '',
        notes: display
      };
    });

    const encounters = entries.filter(r => r.resourceType === 'Encounter').map((e, i) => ({
      id: e.id || i,
      date: (e.period && e.period.start) || '',
      encounter_type: (e.type && e.type[0] && (e.type[0].text || (e.type[0].coding && e.type[0].coding[0] && e.type[0].coding[0].display))) || e.class && e.class.display || 'Encounter',
      provider: (e.participant && e.participant[0] && e.participant[0].individual && e.participant[0].individual.display) || '',
      reason: (e.reasonCode && e.reasonCode[0] && e.reasonCode[0].text) || '',
      notes: ''
    }));

    res.json({ patient, conditions, medications, allergies, observations, encounters });
  } catch (err) {
    res.status(502).json({ error: 'FHIR upstream failure', detail: err.message });
  }
});

// ---------- Error handling ----------
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`MediLink running on http://localhost:${PORT}`);
});
