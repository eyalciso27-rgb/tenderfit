import assert from "node:assert/strict";
import test from "node:test";

import { organizeRequirements } from "../js/requirement-tree.js";

test("requirement tree preserves nested children and exposes an orphan as a root", () => {
  const parent = { requirement_id: "parent", parent_requirement_id: null };
  const child = { requirement_id: "child", parent_requirement_id: "parent" };
  const grandchild = { requirement_id: "grandchild", parent_requirement_id: "child" };
  const orphan = { requirement_id: "orphan", parent_requirement_id: "removed-parent" };
  const result = organizeRequirements([parent, child, grandchild, orphan]);

  assert.deepEqual(result.roots.map((item) => item.requirement_id), ["parent", "orphan"]);
  assert.deepEqual(result.childrenByParent.get("parent").map((item) => item.requirement_id), ["child"]);
  assert.deepEqual(result.childrenByParent.get("child").map((item) => item.requirement_id), ["grandchild"]);
});
