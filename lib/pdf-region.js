import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";

const DEFAULT_OVERLAP_PAGES = 1;
const RISKY_OVERLAP_PAGES = 2;

function isRiskyBoundary(region) {
  return region?.contains_tables === true
    || region?.needs_manual_review === true
    || region?.boundary_confidence === "low";
}

export function planRegionExcerpt(region, documentPageCount) {
  const startPage = Number(region?.start_page);
  const endPage = Number(region?.end_page);
  if (!Number.isInteger(documentPageCount) || documentPageCount < 1) {
    throw new Error("PDF has no readable pages.");
  }
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
    throw new Error("Region page boundaries are required.");
  }
  if (startPage < 1 || endPage < startPage || endPage > documentPageCount) {
    throw new Error("Region page boundaries are outside the PDF.");
  }

  const overlap = isRiskyBoundary(region) ? RISKY_OVERLAP_PAGES : DEFAULT_OVERLAP_PAGES;
  const excerptStartPage = Math.max(1, startPage - overlap);
  const excerptEndPage = Math.min(documentPageCount, endPage + overlap);
  return {
    mode: "region_excerpt",
    target_start_page: startPage,
    target_end_page: endPage,
    excerpt_start_page: excerptStartPage,
    excerpt_end_page: excerptEndPage,
    overlap_before: startPage - excerptStartPage,
    overlap_after: excerptEndPage - endPage,
    page_count: excerptEndPage - excerptStartPage + 1,
    original_page_count: documentPageCount,
  };
}

function setOriginalPageLabels(pdf, firstOriginalPage) {
  const labels = pdf.context.obj({
    Nums: pdf.context.obj([
      PDFNumber.of(0),
      pdf.context.obj({ S: PDFName.of("D"), St: PDFNumber.of(firstOriginalPage) }),
    ]),
  });
  pdf.catalog.set(PDFName.of("PageLabels"), labels);
}

export async function createRegionPdfExcerpt(sourceBytes, region) {
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const plan = planRegionExcerpt(region, source.getPageCount());
  const excerpt = await PDFDocument.create();
  const indexes = Array.from(
    { length: plan.page_count },
    (_, index) => plan.excerpt_start_page - 1 + index,
  );
  const copiedPages = await excerpt.copyPages(source, indexes);
  for (const page of copiedPages) excerpt.addPage(page);

  setOriginalPageLabels(excerpt, plan.excerpt_start_page);
  excerpt.setTitle(`TenderFit excerpt ${plan.excerpt_start_page}-${plan.excerpt_end_page}`);
  excerpt.setSubject(
    `Original tender pages ${plan.excerpt_start_page}-${plan.excerpt_end_page}; target region ${plan.target_start_page}-${plan.target_end_page}`,
  );
  excerpt.setKeywords([
    "TenderFit",
    `source-pages:${plan.excerpt_start_page}-${plan.excerpt_end_page}`,
    `target-pages:${plan.target_start_page}-${plan.target_end_page}`,
  ]);

  return {
    bytes: new Uint8Array(await excerpt.save()),
    info: plan,
  };
}

function appendReviewReason(existing, addition) {
  return existing ? `${existing} ${addition}` : addition;
}

export function normalizeExcerptSourcePages(requirements, excerptInfo) {
  if (excerptInfo?.mode !== "region_excerpt" || !Array.isArray(requirements)) {
    return requirements;
  }
  const pages = requirements
    .map((requirement) => requirement?.source_page)
    .filter(Number.isInteger);
  const usesExcerptPageNumbers = pages.some((page) => (
    page >= 1
    && page <= excerptInfo.page_count
    && page < excerptInfo.target_start_page
  ));

  return requirements.map((requirement) => {
    const rawPage = requirement?.source_page;
    let sourcePage = rawPage;
    if (usesExcerptPageNumbers && Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= excerptInfo.page_count) {
      sourcePage = excerptInfo.excerpt_start_page + rawPage - 1;
    }
    const outsideTarget = !Number.isInteger(sourcePage)
      || sourcePage < excerptInfo.target_start_page
      || sourcePage > excerptInfo.target_end_page;
    if (!outsideTarget && sourcePage === rawPage) return requirement;

    const next = { ...requirement, source_page: sourcePage };
    if (outsideTarget) {
      next.requires_manual_review = true;
      next.review_reason = appendReviewReason(
        next.review_reason,
        "הפניית המקור נמצאת בעמוד הקשר שמחוץ לגבולות האזור ויש לבדוק אותה ידנית.",
      );
    }
    return next;
  });
}
