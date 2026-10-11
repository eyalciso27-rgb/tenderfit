const SECTION_STATUS = Object.freeze({
  strengths: "met",
  gaps: "gap",
  missing_information: "missing",
  review_priorities: "review",
});

export function buildFitAnalysisContext(tender, businessFacts = {}) {
  const requirements = tender?.requirements ?? [];
  const byRequirement = tender?.results?.by_requirement_id ?? {};
  const parentIds = new Set(requirements.map((item) => item.parent_requirement_id).filter(Boolean));
  const referencedFactKeys = new Set();

  const atomicRequirements = requirements
    .filter((requirement) => !parentIds.has(requirement.requirement_id))
    .map((requirement) => {
      const result = byRequirement[requirement.requirement_id] ?? null;
      const factKey = result?.business_fact_key ?? requirement.business_fact_key ?? null;
      if (factKey) referencedFactKeys.add(factKey);
      return {
        requirement_id: requirement.requirement_id,
        requirement_text: requirement.requirement_text,
        requirement_target: requirement.requirement_target,
        stage: requirement.stage,
        is_critical: Boolean(requirement.is_critical),
        code_comparable: Boolean(requirement.code_comparable),
        requires_manual_review: Boolean(requirement.requires_manual_review),
        source_page: requirement.source_page ?? null,
        source_section: requirement.source_section ?? null,
        result: result ? {
          status: result.status,
          explanation: result.explanation,
          business_fact_key: result.business_fact_key ?? null,
          business_value: result.business_value ?? null,
          business_unit: result.business_unit ?? null,
        } : null,
      };
    });

  const relevantFacts = Object.fromEntries(
    [...referencedFactKeys]
      .filter((key) => businessFacts?.[key])
      .map((key) => [key, businessFacts[key]]),
  );

  return {
    tender: {
      title: tender?.title ?? null,
      tender_number: tender?.tender_number ?? null,
      publisher: tender?.publisher ?? null,
      submission_deadline: tender?.submission_deadline ?? null,
    },
    code_summary: {
      counts: tender?.results?.counts ?? {},
      critical_attention_count: tender?.results?.critical_attention_count ?? 0,
      summary: tender?.results?.summary ?? null,
      disclaimer: tender?.results?.disclaimer ?? null,
    },
    requirements: atomicRequirements,
    business_facts: relevantFacts,
  };
}

export function fillFitAnalysisPrompt(template, context) {
  const marker = "{{FIT_CONTEXT_JSON}}";
  if (typeof template !== "string" || !template.includes(marker)) {
    const error = new Error("Fit Analysis prompt marker is missing.");
    error.code = "fit_prompt_invalid";
    throw error;
  }
  return template.replace(marker, JSON.stringify(context));
}

function countValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function buildFitAnalysisDisplaySummary(results = {}) {
  const counts = results.counts ?? {};
  const met = countValue(counts.met);
  const review = countValue(counts.review);
  const gap = countValue(counts.gap);
  const missing = countValue(counts.missing);
  const critical = countValue(results.critical_attention_count);
  const criticalIsWithinReview = critical > 0 && gap === 0 && missing === 0 && critical <= review;

  const metSentence = met === 1
    ? "מניתוח נתוני העסק מול דרישות המכרז עולה כי העסק עומד בדרישה אחת שנבדקה אוטומטית."
    : `מניתוח נתוני העסק מול דרישות המכרז עולה כי העסק עומד ב־${met} דרישות שנבדקו אוטומטית.`;
  const reviewSentence = review === 1
    ? ` דרישה נוספת סומנה לבדיקה ידנית${criticalIsWithinReview && critical === 1 ? ", והיא תנאי סף קריטי" : ""}.`
    : review > 1
      ? ` ${review} דרישות נוספות סומנו לבדיקה ידנית${criticalIsWithinReview ? `, ובהן ${critical} ${critical === 1 ? "תנאי סף קריטי" : "תנאי סף קריטיים"}` : ""}.`
      : " לא סומנו דרישות לבדיקה ידנית.";
  const classificationSentence = gap === 0 && missing === 0
    ? " לפי הנתונים הקיימים, אף דרישה לא סווגה כפער או כחוסר מידע."
    : ` לפי הנתונים הקיימים, ${gap} דרישות סווגו כפער ו־${missing} דרישות סווגו כחוסר מידע.`;

  let nextStep = "";
  if (critical === 1) nextStep = "השלב הבא: לעבור תחילה על תנאי הסף הקריטי שסומן לבדיקה.";
  else if (critical > 1) nextStep = `השלב הבא: לעבור תחילה על ${critical} תנאי הסף הקריטיים שסומנו לבדיקה.`;
  else if (review > 0) nextStep = "השלב הבא: לעבור על הדרישות שסומנו לבדיקה ידנית.";
  else if (gap > 0 || missing > 0) nextStep = "השלב הבא: לעבור על הפערים ועל המידע החסר שסומנו בתוצאות.";

  const criticalSentence = critical > 0 && !criticalIsWithinReview
    ? ` ${critical} ${critical === 1 ? "תנאי סף קריטי דורש" : "תנאי סף קריטיים דורשים"} תשומת לב.`
    : "";

  return { summary: `${metSentence}${reviewSentence}${classificationSentence}${criticalSentence}`, nextStep };
}

export function userFacingAutomationText(value) {
  return String(value ?? "")
    .replaceAll("תוצאות הקוד", "תוצאות הבדיקה האוטומטית")
    .replaceAll("תוצאת הקוד", "תוצאת הבדיקה האוטומטית")
    .replaceAll("לפי הקוד", "לפי הבדיקה האוטומטית")
    .replaceAll("בקוד", "בבדיקה האוטומטית")
    .replaceAll("הקוד", "הבדיקה האוטומטית");
}

export function validateFitAnalysisSemantics(output, results) {
  const errors = [];
  const advisoryLanguage = /(?:מומל(?:ץ|צת|צים|צות)|ממליצ|המלצ|כדאי)/u;
  const explanatoryTexts = [output?.summary];
  const knownResults = results?.by_requirement_id ?? {};
  for (const [section, expectedStatus] of Object.entries(SECTION_STATUS)) {
    const seen = new Set();
    for (const item of output?.[section] ?? []) {
      explanatoryTexts.push(item?.title, item?.explanation);
      const result = knownResults[item.requirement_id];
      if (!result) errors.push(`${section}:${item.requirement_id}:unknown_requirement`);
      else if (result.status !== expectedStatus) errors.push(`${section}:${item.requirement_id}:expected_${expectedStatus}`);
      if (seen.has(item.requirement_id)) errors.push(`${section}:${item.requirement_id}:duplicate`);
      seen.add(item.requirement_id);
    }
  }
  if (explanatoryTexts.some((value) => advisoryLanguage.test(String(value ?? "")))) {
    errors.push("prohibited_recommendation_language");
  }
  return { valid: errors.length === 0, errors };
}
