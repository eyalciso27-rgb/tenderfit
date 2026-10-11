export function organizeRequirements(requirements) {
  const items = Array.isArray(requirements) ? requirements : [];
  const ids = new Set(items.map((item) => item.requirement_id));
  const childrenByParent = new Map();
  const roots = [];

  for (const requirement of items) {
    const parentId = requirement.parent_requirement_id;
    if (!parentId || parentId === requirement.requirement_id || !ids.has(parentId)) {
      roots.push(requirement);
      continue;
    }
    const children = childrenByParent.get(parentId) ?? [];
    children.push(requirement);
    childrenByParent.set(parentId, children);
  }

  return { roots, childrenByParent };
}
