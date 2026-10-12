import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTenderCategoryIndex,
  categoryKeysForSubtree,
  tenderCategoriesEnabled,
  tenderCategoryForRequirement,
} from "../lib/tender-categories.js";

test("category navigation is enabled for every saved tender", () => {
  assert.equal(tenderCategoriesEnabled("fada3e4c-7825-4bd2-aeef-63277975eef2"), true);
  assert.equal(tenderCategoriesEnabled("another-tender"), true);
  assert.equal(tenderCategoriesEnabled(""), false);
  assert.equal(tenderCategoriesEnabled(null), false);
});

test("source categories become tender-specific groups in document order", () => {
  const requirements = [
    { requirement_id: "r2", category: "ניקיון ותברואה", source_page: 18 },
    { requirement_id: "r1", category: "ביטחון", source_page: 4 },
    { requirement_id: "r3", category: "ניקיון ותברואה", source_page: 21 },
  ];
  const index = buildTenderCategoryIndex(requirements);

  assert.deepEqual(index.groups.map((group) => group.label), ["ביטחון", "ניקיון ותברואה"]);
  assert.deepEqual(index.groups[1].requirementIds, ["r2", "r3"]);
  assert.equal(index.categoryByRequirementId.get("r1"), "category:ביטחון");
});

test("generic category falls back to its mapper region instead of an invented global category", () => {
  const requirement = {
    requirement_id: "region_8_sow_operations:item-1",
    category: "other",
    source_section: "5.2",
  };
  const category = tenderCategoryForRequirement(requirement, [
    { region_id: "region_8_sow_operations", title: "SOW - Core Operations, SLA, and Penalties" },
  ]);

  assert.deepEqual(category, {
    key: "region:region_8_sow_operations",
    label: "SOW - Core Operations, SLA, and Penalties",
    source: "region",
  });
});

test("a parent remains visible in every category represented by its atomic children", () => {
  const parent = { requirement_id: "parent", category: "כללי", source_page: 1 };
  const hygiene = { requirement_id: "hygiene", parent_requirement_id: "parent", category: "תברואה", source_page: 2 };
  const security = { requirement_id: "security", parent_requirement_id: "parent", category: "ביטחון", source_page: 3 };
  const index = buildTenderCategoryIndex([parent, hygiene, security]);
  const childrenByParent = new Map([["parent", [hygiene, security]]]);

  assert.deepEqual(
    [...categoryKeysForSubtree(parent, childrenByParent, index.categoryByRequirementId)],
    ["category:תברואה", "category:ביטחון"],
  );
  assert.equal(index.groups.reduce((sum, group) => sum + group.requirementIds.length, 0), 2);
});
