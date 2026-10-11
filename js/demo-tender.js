const DEFAULT_DEMO_NOTICE = "עותק הדגמה: מועד ההגשה הותאם לצורכי הצגת המערכת ואינו המועד המקורי.";

export function tenderDemoNotice(metadata) {
  const demo = metadata?.demo;
  if (demo?.is_demo !== true) return null;
  return typeof demo.notice_he === "string" && demo.notice_he.trim()
    ? demo.notice_he.trim()
    : DEFAULT_DEMO_NOTICE;
}
