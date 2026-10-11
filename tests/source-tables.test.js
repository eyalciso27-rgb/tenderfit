import test from "node:test";
import assert from "node:assert/strict";

import { groupTableRequirements, referencesTable } from "../js/source-tables.js";

test("detects a paragraph that explicitly refers to a table", () => {
  assert.equal(referencesTable({ requirement_text: "יש לפעול בהתאם לטבלאות שלהלן" }), true);
  assert.equal(referencesTable({ requirement_text: "יש לצרף תעודה" }), false);
});

test("groups and orders extracted table items without inventing missing cells", () => {
  const groups = groupTableRequirements([
    { requirement_id: "b", source_type: "table", table_id: "שבוע 1", source_section: "5", source_page: 85, row_index: 2, column_index: 1 },
    { requirement_id: "paragraph", source_type: "paragraph", source_page: 84 },
    { requirement_id: "a", source_type: "table", table_id: "שבוע 1", source_section: "5", source_page: 84, row_index: 1, column_index: 1 },
    { requirement_id: "c", source_type: "table", table_id: "שבוע 2", source_section: "5", source_page: 87, row_index: 1, column_index: 1 },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].requirements.map((item) => item.requirement_id), ["a", "b"]);
  assert.equal(groups[1].title, "שבוע 2");
});
