export const CATEGORY_PILOT_TENDER_ID = "fada3e4c-7825-4bd2-aeef-63277975eef2";

const GENERIC_CATEGORIES = new Set(["", "other", "general"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizedKey(value) {
  return cleanText(value).toLocaleLowerCase("he-IL");
}

function regionIdFromRequirement(requirement) {
  const requirementId = cleanText(requirement?.requirement_id);
  const separatorIndex = requirementId.indexOf(":");
  return separatorIndex > 0 ? requirementId.slice(0, separatorIndex) : null;
}

function sourcePage(requirement) {
  const page = Number(requirement?.source_page);
  return Number.isFinite(page) && page > 0 ? page : Number.MAX_SAFE_INTEGER;
}

export function pilotCategoriesEnabled(tenderId) {
  return tenderId === CATEGORY_PILOT_TENDER_ID;
}

export function tenderCategoryForRequirement(requirement, regions = []) {
  const rawCategory = cleanText(requirement?.category);
  const normalizedCategory = normalizedKey(rawCategory).replace(/[\s-]+/g, "_");
  if (!GENERIC_CATEGORIES.has(normalizedCategory)) {
    return {
      key: `category:${normalizedKey(rawCategory)}`,
      label: rawCategory,
      source: "category",
    };
  }

  const regionId = regionIdFromRequirement(requirement);
  const region = regionId
    ? regions.find((item) => item?.region_id === regionId)
    : null;
  const regionTitle = cleanText(region?.title);
  if (regionTitle) {
    return {
      key: `region:${regionId}`,
      label: regionTitle,
      source: "region",
    };
  }

  const sourceSection = cleanText(requirement?.source_section);
  if (sourceSection) {
    return {
      key: `section:${normalizedKey(sourceSection)}`,
      label: sourceSection,
      source: "section",
    };
  }

  return {
    key: "other",
    label: "דרישות נוספות",
    source: "fallback",
  };
}

export function buildTenderCategoryIndex(requirements = [], regions = []) {
  const items = Array.isArray(requirements) ? requirements : [];
  const parentIds = new Set(items.map((item) => item?.parent_requirement_id).filter(Boolean));
  const atomicItems = items.filter((item) => item?.requirement_id && !parentIds.has(item.requirement_id));
  const groupsByKey = new Map();
  const categoryByRequirementId = new Map();

  atomicItems.forEach((requirement, index) => {
    const category = tenderCategoryForRequirement(requirement, regions);
    categoryByRequirementId.set(requirement.requirement_id, category.key);
    const existing = groupsByKey.get(category.key);
    if (existing) {
      existing.requirementIds.push(requirement.requirement_id);
      existing.firstPage = Math.min(existing.firstPage, sourcePage(requirement));
      return;
    }
    groupsByKey.set(category.key, {
      ...category,
      requirementIds: [requirement.requirement_id],
      firstPage: sourcePage(requirement),
      firstSeen: index,
    });
  });

  const groups = [...groupsByKey.values()].sort((first, second) =>
    first.firstPage - second.firstPage || first.firstSeen - second.firstSeen,
  );

  return { groups, categoryByRequirementId };
}

export function categoryKeysForSubtree(requirement, childrenByParent, categoryByRequirementId) {
  const keys = new Set();
  const visited = new Set();

  function visit(item) {
    const requirementId = item?.requirement_id;
    if (!requirementId || visited.has(requirementId)) return;
    visited.add(requirementId);
    const children = childrenByParent.get(requirementId) ?? [];
    if (!children.length) {
      const categoryKey = categoryByRequirementId.get(requirementId);
      if (categoryKey) keys.add(categoryKey);
      return;
    }
    children.forEach(visit);
  }

  visit(requirement);
  return keys;
}
