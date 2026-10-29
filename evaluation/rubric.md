# AI Evaluation Rubric & Quality Benchmark Specification

## Purpose
This document establishes the official evaluation standard for Resume Coach's resume-to-job-description analysis engine. It provides a formal, reproducible methodology to evaluate model capabilities across multiple objective and rubric-calibrated dimensions, preventing subjective impressions from being conflated with objective model accuracy.

---

## 1. Evaluation Dimensions & Formulas

### Dimension 1: Skill Extraction Correctness
Measures the model's ability to extract technical and domain skills actually stated in the candidate's resume, avoiding both omissions and phantom skill attributions.

- **True Positives ($TP_{skills}$)**: Skills extracted by the model that are explicitly validated in the reference ground truth.
- **False Positives ($FP_{skills}$)**: Skills extracted by the model that are absent from the resume text (hallucinations or extrapolations).
- **False Negatives ($FN_{skills}$)**: Actual skills present in the resume text that the model failed to extract.

$$\text{Precision}_{skills} = \frac{TP_{skills}}{TP_{skills} + FP_{skills}}$$

$$\text{Recall}_{skills} = \frac{TP_{skills}}{TP_{skills} + FN_{skills}}$$

$$\text{F1}_{skills} = 2 \times \frac{\text{Precision}_{skills} \times \text{Recall}_{skills}}{\text{Precision}_{skills} + \text{Recall}_{skills}}$$

---

### Dimension 2: Evidence-Based Skill Gap Identification
Measures whether the model correctly identifies delta gaps between the candidate's verified skills and the target Job Description's requirements.

- **True Positives ($TP_{gaps}$)**: Skill gaps flagged by the model that are genuinely required by the JD but missing from the resume.
- **False Positives ($FP_{gaps}$)**: Gaps flagged by the model that the candidate actually possesses in their resume (false alarms).
- **False Negatives ($FN_{gaps}$)**: Genuine gaps required by the JD that the model missed.

$$\text{Precision}_{gaps} = \frac{TP_{gaps}}{TP_{gaps} + FP_{gaps}}$$

$$\text{Recall}_{gaps} = \frac{TP_{gaps}}{TP_{gaps} + FN_{gaps}}$$

$$\text{F1}_{gaps} = 2 \times \frac{\text{Precision}_{gaps} \times \text{Recall}_{gaps}}{\text{Precision}_{gaps} + \text{Recall}_{gaps}}$$

---

### Dimension 3: ATS Score Calibration
Measures whether the numerical ATS score assigned by the model falls within the human-reviewed, expert-calibrated score band $[S_{min}, S_{max}]$ for the resume-JD match tier:
- **High Match (80-100)**: Candidate satisfies $\ge 80\%$ of core requirements.
- **Partial Match (40-75)**: Candidate has transferable skills or meets $\sim 50\%$ of requirements.
- **Low/Irrelevant Match (0-35)**: Mismatch in role domain or severe lack of prerequisite technical qualifications.

$$\text{Calibration Accuracy} = \frac{\sum \mathbb{I}(S_{min} \le S_{model} \le S_{max})}{N_{cases}}$$

$$\text{Mean Absolute Deviation (MAD)} = \frac{1}{N_{cases}} \sum \max(0, S_{min} - S_{model}, S_{model} - S_{max})$$

---

### Dimension 4: Grounding & Hallucination Resistance
Measures whether the generated suggestions, bullet points, and extracted details are strictly grounded in the candidate's provided background:

- **Grounding Ratio**: Percentage of extracted entities and claims directly traceable to the resume text.
- **Hallucination Detection Rate**: Verification against a suite of `prohibitedClaims` (assertions of certifications, unearned degrees, inflated metrics, or technologies nowhere present in source resume).

$$\text{Hallucination Rate} = \frac{\text{Detected Hallucinatory Claims}}{\text{Total Claims Checked}} \times 100\%$$

$$\text{Grounding Score} = (1 - \text{Hallucination Rate}) \times 100\%$$

---

### Dimension 5: Recommendation Relevance & Actionability
Evaluated on a 5-point Likert rubric:
- **5 (Exemplary)**: Specific, quantitative suggestions directly tailored to the role, naming specific missing keywords and structural ATS tips.
- **4 (Good)**: Actionable feedback with minor generic statements.
- **3 (Acceptable)**: Relevant but somewhat generic (e.g., "Add more numbers").
- **2 (Poor)**: Generic advice that does not reference the target role or resume context.
- **1 (Unusable)**: Factually incorrect or contradictory suggestions.

---

## 2. Dataset Versioning & De-identification
- **Dataset File**: `evaluation/dataset/eval-dataset.json` (Version `1.0.0`)
- **Privacy Standard**: 100% synthetic and anonymized profiles. No private user data, proprietary company IP, or identifiable candidate information is included.
- **Distribution**: 12 diverse test cases covering 3 experience tiers (Entry, Mid, Senior), 3 job functions (Software Engineering, Data Analytics, Product/HR), and 3 relevance levels (High, Partial, Low).

