// Synthetic data for the prior-authorization demo. No real patients, plans or policies.

export type Criterion = { criterion: string; met: boolean; evidence: string; citation: string };

export interface PACase {
  id: string;
  emoji: string;
  title: string;
  patient: { name: string; age: number; sex: "F" | "M"; memberId: string; mrn: string };
  service: { name: string; code: string; codeSystem: string; setting: string };
  diagnosis: { code: string; text: string }[];
  provider: { name: string; npi: string; clinic: string };
  urgency: "standard" | "expedited";
  /** Clinical notes the provider's EHR returns over MCP. */
  notes: string[];
  /** Extra documentation the provider can find if the payer asks (A2A input-required). */
  supplemental?: string[];
  /** Offline (no-key) assessment, round 1 and after supplemental docs. */
  offline: { round1: Criterion[]; round2?: Criterion[] };
  policyHint: string;
}

export const CASES: PACase[] = [
  {
    id: "mri",
    emoji: "🩻",
    title: "Lumbar spine MRI",
    patient: { name: "Maria Lopez", age: 52, sex: "F", memberId: "SHP-100231", mrn: "MRN-88412" },
    service: { name: "MRI lumbar spine without contrast", code: "72148", codeSystem: "CPT", setting: "Outpatient imaging" },
    diagnosis: [{ code: "M54.16", text: "Radiculopathy, lumbar region" }],
    provider: { name: "Dr. Anil Mehta", npi: "1093817465", clinic: "Riverside Spine Clinic" },
    urgency: "standard",
    notes: [
      "2026-09-02: Low back pain radiating to left leg, onset ~9 weeks ago. No trauma.",
      "2026-09-02 to 2026-10-14: Physical therapy 12 sessions over 6 weeks; minimal improvement (pain 7/10 → 6/10).",
      "Naproxen 500 mg BID x 6 weeks, partial relief.",
      "2026-11-18: New numbness L5 distribution, positive straight-leg raise on left. Strength 5/5.",
    ],
    offline: {
      round1: [
        { criterion: "Low back pain ≥ 6 weeks", met: true, evidence: "Onset ~9 weeks ago", citation: "POL-RAD-014 §2" },
        { criterion: "Failed ≥ 6 weeks conservative therapy (PT and/or medication)", met: true, evidence: "PT 12 sessions over 6 weeks + naproxen 6 weeks, minimal improvement", citation: "POL-RAD-014 §2" },
        { criterion: "Radicular symptoms supporting imaging", met: true, evidence: "New L5 numbness, positive SLR", citation: "POL-RAD-014 §3" },
      ],
    },
    policyHint: "MRI lumbar spine low back pain conservative therapy radiculopathy",
  },
  {
    id: "glp1",
    emoji: "💊",
    title: "GLP-1 for weight management",
    patient: { name: "James Carter", age: 47, sex: "M", memberId: "SHP-204417", mrn: "MRN-55190" },
    service: { name: "Semaglutide 2.4 mg weekly injection (chronic weight management)", code: "0169-4524-14", codeSystem: "NDC", setting: "Pharmacy benefit" },
    diagnosis: [{ code: "E66.811", text: "Obesity, class 1" }],
    provider: { name: "Dr. Sarah Kim", npi: "1427196503", clinic: "Northside Family Medicine" },
    urgency: "standard",
    notes: [
      "2026-11-10: BMI 28.6 (weight 94 kg, height 181 cm). Patient requests weight-loss medication.",
      "Counselled on diet and exercise.",
      "No other GLP-1 receptor agonist on medication list.",
    ],
    supplemental: [
      "Problem list: Essential hypertension (I10) diagnosed 2024, on lisinopril 10 mg daily.",
      "2026-06-01 to 2026-10-30: Enrolled in dietitian-led lifestyle program, 5 months, 10 visits documented, weight change -1.8 kg.",
    ],
    offline: {
      round1: [
        { criterion: "BMI ≥ 30, or BMI ≥ 27 with ≥ 1 weight-related comorbidity", met: false, evidence: "BMI 28.6; no comorbidity documented in submitted notes", citation: "POL-RX-201 §2" },
        { criterion: "≥ 3 months documented lifestyle / behavioural program", met: false, evidence: "Only general counselling documented", citation: "POL-RX-201 §2" },
        { criterion: "Not combined with another GLP-1 receptor agonist", met: true, evidence: "No other GLP-1 on medication list", citation: "POL-RX-201 §3" },
      ],
      round2: [
        { criterion: "BMI ≥ 30, or BMI ≥ 27 with ≥ 1 weight-related comorbidity", met: true, evidence: "BMI 28.6 + essential hypertension (I10) on lisinopril", citation: "POL-RX-201 §2" },
        { criterion: "≥ 3 months documented lifestyle / behavioural program", met: true, evidence: "Dietitian-led program, 5 months, 10 visits", citation: "POL-RX-201 §2" },
        { criterion: "Not combined with another GLP-1 receptor agonist", met: true, evidence: "No other GLP-1 on medication list", citation: "POL-RX-201 §3" },
      ],
    },
    policyHint: "GLP-1 semaglutide weight management BMI comorbidity lifestyle program",
  },
  {
    id: "brca",
    emoji: "🧬",
    title: "BRCA1/2 genetic test",
    patient: { name: "Priya Raman", age: 38, sex: "F", memberId: "SHP-318820", mrn: "MRN-60277" },
    service: { name: "BRCA1/BRCA2 full sequence & deletion/duplication analysis", code: "81162", codeSystem: "CPT", setting: "Reference laboratory" },
    diagnosis: [{ code: "Z80.3", text: "Family history of malignant neoplasm of breast" }],
    provider: { name: "Dr. Elena Rossi", npi: "1336284019", clinic: "Lakeside Women's Health" },
    urgency: "standard",
    notes: [
      "2026-11-05: Patient anxious about breast cancer risk. Maternal aunt diagnosed with breast cancer at age 62.",
      "No personal history of cancer. No known familial mutation. No Ashkenazi Jewish ancestry reported.",
      "Genetic counselling not yet performed.",
    ],
    offline: {
      round1: [
        { criterion: "Personal history of breast cancer ≤ 45, ovarian, pancreatic or male breast cancer", met: false, evidence: "No personal cancer history", citation: "POL-LAB-077 §2" },
        { criterion: "Close relative with breast cancer ≤ 45, ovarian cancer, male breast cancer, or known familial variant", met: false, evidence: "Second-degree relative with breast cancer at 62 only", citation: "POL-LAB-077 §2" },
        { criterion: "Pre-test genetic counselling documented", met: false, evidence: "Genetic counselling not yet performed", citation: "POL-LAB-077 §3" },
      ],
    },
    policyHint: "BRCA1 BRCA2 hereditary breast ovarian cancer genetic testing family history counselling",
  },
];

/** Payer medical-policy library, the corpus for RAG. Each section becomes one chunk. */
export const POLICIES: { id: string; title: string; sections: string[] }[] = [
  {
    id: "POL-RAD-014",
    title: "Advanced Imaging: MRI of the Lumbar Spine",
    sections: [
      "Scope: Applies to MRI of the lumbar spine (CPT 72148, 72149, 72158) for adult members in outpatient settings. Prior authorization is required.",
      "Medically necessary for low back pain when symptoms have persisted for at least 6 weeks AND the member has failed at least 6 weeks of provider-directed conservative therapy, such as physical therapy, NSAIDs or activity modification.",
      "Medically necessary without a trial of conservative therapy when red flags are present: progressive or severe neurological deficit, suspected cauda equina syndrome, suspected malignancy or infection, or significant trauma. Radicular symptoms with objective findings (dermatomal numbness, positive straight-leg raise) support imaging after conservative therapy.",
      "Not medically necessary: routine imaging for acute, uncomplicated low back pain of less than 6 weeks duration without red flags.",
    ],
  },
  {
    id: "POL-RX-201",
    title: "GLP-1 Receptor Agonists for Chronic Weight Management",
    sections: [
      "Scope: Applies to semaglutide 2.4 mg, liraglutide 3 mg and tirzepatide when prescribed for chronic weight management under the pharmacy benefit. Prior authorization is required. Use for type 2 diabetes is covered under a separate policy.",
      "Initial approval (6 months) requires: BMI ≥ 30 kg/m², OR BMI ≥ 27 kg/m² with at least one weight-related comorbidity (hypertension, type 2 diabetes, dyslipidemia, obstructive sleep apnea, cardiovascular disease); AND documented participation in a lifestyle or behavioural weight-management program for at least 3 months.",
      "The drug must not be used in combination with another GLP-1 receptor agonist. Reauthorization after 6 months requires documented weight loss of at least 5% from baseline.",
      "If documentation is incomplete, the request is pended and the prescriber is asked for the missing information before any adverse determination.",
    ],
  },
  {
    id: "POL-LAB-077",
    title: "Hereditary Breast and Ovarian Cancer Genetic Testing (BRCA1/2)",
    sections: [
      "Scope: Applies to BRCA1/BRCA2 sequencing and deletion/duplication analysis (CPT 81162, 81163, 81164) and multigene hereditary cancer panels. Prior authorization is required.",
      "Medically necessary when the member has a personal history of breast cancer diagnosed at age 45 or younger, ovarian, pancreatic or metastatic prostate cancer at any age, or male breast cancer; OR a first- or second-degree relative with breast cancer at age 45 or younger, ovarian cancer, male breast cancer, or a known pathogenic BRCA variant in the family.",
      "Pre-test genetic counselling by a qualified provider must be documented. Testing is not medically necessary for members who do not meet personal or family history criteria, including family history limited to a single relative with breast cancer diagnosed after age 50.",
    ],
  },
  {
    id: "POL-ADM-001",
    title: "Prior Authorization Process and Timeframes",
    sections: [
      "Standard prior authorization decisions are issued within 7 calendar days and expedited decisions within 72 hours of receiving a complete request, consistent with the CMS Interoperability and Prior Authorization rule (CMS-0057-F).",
      "Any adverse determination (denial) for medical necessity must be reviewed and signed by a physician or appropriate clinical peer. Automated systems may approve, or may pend for information, but may not issue a denial without human clinical review.",
      "Every denial must state a specific reason, cite the policy criteria not met, and explain appeal rights and the option of a peer-to-peer discussion.",
      "Providers with a 90% or higher approval rate on a service over 12 months may qualify for gold-carding, which exempts them from prior authorization for that service.",
    ],
  },
  {
    id: "POL-SURG-033",
    title: "Arthroscopic Knee Surgery",
    sections: [
      "Arthroscopic partial meniscectomy is medically necessary for mechanical symptoms (locking, catching) with MRI-confirmed meniscal tear after failed conservative therapy. Arthroscopic debridement for knee osteoarthritis alone is not medically necessary.",
    ],
  },
  {
    id: "POL-DME-010",
    title: "Positive Airway Pressure (CPAP) Devices",
    sections: [
      "CPAP is covered for obstructive sleep apnea confirmed by sleep study with AHI ≥ 15, or AHI 5–14 with documented symptoms. Continued coverage after 90 days requires adherence of at least 4 hours per night on 70% of nights.",
    ],
  },
];

/** Payer core-admin data, exposed to the payer agent over MCP. */
export const MEMBERS: Record<string, { plan: string; active: boolean; effective: string; pcp: string }> = {
  "SHP-100231": { plan: "Sunrise Gold PPO", active: true, effective: "2026-01-01", pcp: "Dr. Anil Mehta" },
  "SHP-204417": { plan: "Sunrise Silver HMO", active: true, effective: "2025-07-01", pcp: "Dr. Sarah Kim" },
  "SHP-318820": { plan: "Sunrise Gold PPO", active: true, effective: "2024-03-01", pcp: "Dr. Elena Rossi" },
};

export const BENEFITS: Record<string, { covered: boolean; paRequired: boolean; costShare: string; policy: string }> = {
  "72148": { covered: true, paRequired: true, costShare: "$75 copay after deductible", policy: "POL-RAD-014" },
  "0169-4524-14": { covered: true, paRequired: true, costShare: "Tier 3 · $60 copay", policy: "POL-RX-201" },
  "81162": { covered: true, paRequired: true, costShare: "20% coinsurance", policy: "POL-LAB-077" },
};
