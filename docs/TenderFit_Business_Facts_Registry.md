# TenderFit — Business Facts Registry for Claude Code

## מה Claude Code צריך

Claude Code לא צריך רשימה קשיחה של כל השדות האפשריים בעולם. הוא צריך:

1. Schema קבוע לרשומת Business Fact.
2. רשימת Seed של Facts שכבר זוהו במכרזים אמיתיים.
3. כלל Runtime שמאפשר למכרז חדש ליצור Fact חדש.
4. Normalization/Dedup כדי ששמות שונים לאותו נתון לא ייצרו כפילויות.

**כלל מחייב:** הקובץ הזה הוא Seed Registry ולא Closed Enum.

## Schema

```json
{
  "business_fact_key": "string",
  "business_fact_type": "number|currency|boolean|date|enum|string",
  "unit": "string|null",
  "value": "typed value|null",
  "status": "known|missing|needs_review",
  "aliases": [],
  "source": "user|document|verified_external|null",
  "updated_at": "timestamp|null"
}
```

## Runtime

```text
Extractor returns business_fact_key
→ normalize/alias lookup
→ if canonical fact exists: reuse it
→ if it does not exist: create dynamic fact with status=missing
→ ask user for the missing value
→ compare in code only when code_comparable=true
```

## Facts שכבר זוהו בשני המכרזים שסופקו

| key | type | unit | source | code comparable |
|---|---|---|---|---|
| `bidder_system_relationship` | `enum` | — | tender_2_2025 p.8 | yes |
| `systems_installed_since_2023_count` | `number` | systems | tender_2_2025 p.8 | yes |
| `qualifying_active_clients_count` | `number` | clients | tender_2_2025 p.8 | yes |
| `simultaneous_sms_throughput` | `number` | SMS | tender_2_2025 p.8 | yes |
| `supports_sms_all_israel_and_international_carriers` | `boolean` | — | tender_2_2025 p.8 | no |
| `registered_entity_in_israel` | `boolean` | — | tender_2_2025 p.8 | yes |
| `required_legal_licenses_valid` | `boolean` | — | tender_2_2025 p.8 | yes |
| `public_entities_transactions_compliant` | `boolean` | — | tender_2_2025 p.8 | yes |
| `going_concern_warning_absent` | `boolean` | — | tender_2_2025 p.8 | yes |
| `maximum_supported_attachment_size_mb` | `number` | MB | tender_2_2025 p.26 | yes |
| `supports_monthly_and_yearly_reports` | `boolean` | — | tender_2_2025 p.27 | no |
| `supports_adaptive_sms_length_per_operator` | `boolean` | — | tender_2_2025 p.28 | no |
| `supports_text_to_voice_conversion_kosher_phones` | `boolean` | — | tender_2_2025 p.28 | no |
| `supports_continuous_chat` | `boolean` | — | tender_2_2025 p.28 | no |
| `supports_smtp_interface` | `boolean` | — | tender_2_2025 p.28 | no |
| `supports_api_rest_ws_soap` | `boolean` | — | tender_2_2025 p.28 | no |
| `food_service_avg_daily_diners_experience` | `number` | diners | tender_20_2026 p.15 | yes |
| `food_service_experience_start_date` | `date` | — | tender_20_2026 p.15 | yes |
| `simultaneous_food_service_sites_count` | `number` | sites | tender_20_2026 p.16 | yes |
| `simultaneous_food_service_total_daily_diners` | `number` | diners | tender_20_2026 p.16 | yes |
| `food_service_reference_clients_count` | `number` | clients | tender_20_2026 p.16 | yes |
| `dairy_kitchen_daily_diners` | `number` | diners | tender_20_2026 p.16 | yes |
| `dairy_kitchen_experience_years` | `number` | years | tender_20_2026 p.16 | yes |
| `refreshment_services_annual_value` | `currency` | ILS | tender_20_2026 p.16 | yes |
| `head_chef_professional_profile` | `string` | — | tender_20_2026 p.17 | no |
| `operations_manager_professional_profile` | `string` | — | tender_20_2026 p.17 | no |
| `valid_kosher_certificate` | `boolean` | — | tender_20_2026 p.109 | yes |
| `valid_food_service_licenses` | `boolean` | — | tender_20_2026 p.21 | yes |
| `labor_law_convictions_last_3_years` | `number` | convictions | tender_20_2026 p.14 | yes |
| `labor_law_financial_sanctions_last_3_years` | `number` | sanctions | tender_20_2026 p.14 | yes |
| `labor_law_fines_last_year` | `number` | fines | tender_20_2026 p.14 | yes |

## הנחיה ל-Claude Code

אין ליצור עמודה חדשה ב-DB לכל Fact.
Business Facts נשמרים כרשומות דינמיות.
אין להגביל את `business_fact_key` ל-enum של הרשימה לעיל.
כן יש להגביל את `business_fact_type` לששת הטיפוסים של V3.5.
דרישה שמצריכה Fact חסר מחזירה Missing Business Fact ולא FAIL.
דרישה איכותית או Fact שלא ניתן לאמת דטרמיניסטית עוברים ל-Review.