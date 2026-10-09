מסמך זה הוא ה-Baseline הטכני המלא. הוא כולל את כל ההגדרות שאושרו, System Instructions מלאים, Structured Output Schema מלא, User Prompt של ה-Benchmark, ומיפוי ישיר ל-Gemini API.

**Scope note:** מסמך זה נשאר ה-Baseline הטכני של **Requirement Extractor V3.5**, אך עודכן לאחר השלמת אימות ה-Requirement Mapper. נכון לגרסה זו, גם **Requirement Mapper V1.2** וגם **Requirement Extractor V3.5** מסומנים **MVP Validated**.

הארכיטקטורה המאומתת כעת היא:

`Full Tender PDF → Requirement Mapper V1.2 → Region list/boundaries → Extractor V3.5 per region → Merge/Dedup → Business Facts / Comparison Engine`

ה-Mapper עבר Blind Generalization על שני מכרזים שונים מהותית: מכרז טכנולוגי בן 135 עמודים ומכרז הסעדה בן 171 עמודים.

תאריך אימות תיעוד API: 08/10/2026. מקורות API: Google AI for Developers — Interactions API, Structured Outputs, Thinking, File Input Methods.

# 1. Baseline — אין לשנות ללא גרסה חדשה

| **ערך**                                | **פרמטר**                 |
|----------------------------------------|---------------------------|
| V3.5                                   | Extractor version         |
| gemini-3.1-pro-preview                 | Model                     |
| high                                   | Thinking level            |
| 0.1                                    | Temperature               |
| application/json + JSON Schema         | Structured output         |
| OFF                                    | Google Search / Grounding |
| OFF                                    | Google Maps               |
| OFF                                    | URL Context               |
| OFF                                    | Code Execution            |
| OFF                                    | Function Calling          |
| Single-turn / stateless extractor call | Conversation mode         |
| Recommended: store=false               | Interaction storage       |

חשוב: Google ממליצה כיום להשאיר Temperature=1.0 במודלי Gemini 3 באופן כללי, אך ה-Baseline של TenderFit נבדק בפועל עם 0.1 והגיע לתוצאות ה-MVP שאושרו. לכן 0.1 נשמר לצורך שחזור מדויק של ה-Benchmark. שינוי ל-1.0 צריך להיחשב ניסוי/גרסה חדשה ולהיבדק מחדש.

## 1.1 סטטוס מערכת מאומת

- **Requirement Mapper V1.2 — MVP VALIDATED**
- **Requirement Extractor V3.5 — MVP VALIDATED**

שני הרכיבים הם Baseline נפרד. אין לשנות Prompt / Schema / Model / Temperature של אחד מהם ללא version bump ו-Regression Test.

# 2. ארכיטקטורת קריאת API

- העלאת PDF דרך Gemini Files API, במיוחד כאשר הקובץ גדול או ישמש ביותר מבקשה אחת.

- קריאה ל-Interactions API עם model, system_instruction, input, generation_config ו-response_format.

- אין להעביר tools ל-Extractor, כדי להשאיר Search, URL Context, Code Execution ו-Function Calling כבויים.

- response_format מוגדר כ-application/json עם ה-JSON Schema המלא.

- לאחר קבלת output_text יש לבצע json.loads ואז Validation בצד השרת מול אותו Schema לפני שמירה למסד הנתונים.

לפי תיעוד Google העדכני, Interactions API הוא הממשק המומלץ לפרויקטים חדשים. הוא תומך ב-system_instruction, generation_config (כולל thinking_level ו-temperature), Structured Outputs ו-input של מסמכים. קובצי PDF ניתנים להעברה דרך File API; העלאות File API נשמרות זמנית, ותיעוד Google מציין חלון של 48 שעות.

## 2.1 Requirement Mapping — Validated production baseline

לפני ה-Extractor קיים שלב נפרד ומאומת: **Requirement Mapper V1.2**.

ה-Mapper מקבל את **המכרז המלא** ואינו אמור לקבל מהמשתמש מספרי עמודים או שמות אזורים צפויים. תפקידו לזהות את כל האזורים שבהם קיימות דרישות ולהחזיר גבולות, סוג אזור, תקציר תוכן, תתי-נושאים ו-Evidence.

### Mapper V1.2 baseline

| פרמטר | ערך |
|---|---|
| Version | V1.2 |
| Model | `gemini-3.1-pro-preview` |
| Thinking level | `high` |
| Temperature | `1.0` |
| Structured output | ON |
| External tools | OFF |
| Status | **MVP Validated** |

### תוצאות האימות

**Benchmark 1 — מכרז טכנולוגי, 135 עמודים**
- 17/17 אזורי Reference כוסו
- 0 החמצות קריטיות ידועות
- Evidence: 20/20 high-confidence

**Benchmark 2 — מכרז הסעדה, 171 עמודים**
- V1.2 הורץ ללא שינוי
- 13/13 נקודות ביקורת עצמאיות כוסו
- 0 החמצות קריטיות ידועות
- 22 regions הוחזרו
- Evidence: 39/41 high-confidence
- שני ה-Evidence החלשים סווגו כבעיית quote fidelity ולא כהחמצת אזור או חוסר הבנת תוכן

### ארכיטקטורה מחייבת

`Full Tender PDF → Requirement Mapper V1.2 → Region list/boundaries → Extractor V3.5 per region → Merge/Dedup → Business Facts / Comparison Engine`

אין להשתמש ב-Extractor ישירות על כל המכרז כתחליף ל-Mapper.

שינוי ב-Prompt / Schema / Model / Temperature של ה-Mapper מחייב יצירת גרסה חדשה ו-Regression Test.

# 3. System Instructions — FULL V3.5

You are the Tender Analysis Agent for TenderFit.

Your sole responsibility is to analyze tender documents and extract structured requirements from the requested tender region.

You do NOT compare tender requirements to a business profile.

You do NOT determine whether a specific company complies.

You do NOT make Go / No-Go decisions.

You do NOT perform bidder eligibility decisions.

Your responsibility is only to answer:

"What does the tender require?"

CORE PRINCIPLE

AI extracts and normalizes.

Code compares.

Human decides.

The output of this agent is a structured representation of tender requirements that can later be used by deterministic comparison code and human review.

Never perform bidder comparison yourself.

DOMAIN INDEPENDENCE

The extraction logic must work across all tender domains, including:

\- IT

\- cybersecurity

\- software

\- cloud

\- construction

\- infrastructure

\- cleaning

\- sanitation

\- catering

\- security

\- logistics

\- consulting

\- healthcare

\- professional services

\- equipment

\- maintenance

\- other tender domains

Do not assume a fixed business domain.

Do not create rules that depend on a specific tender, specific page numbering pattern, or specific source row number.

The extraction logic must remain reusable across different tenders.

SOURCE AUTHORITY

The tender source is authoritative.

Never silently:

\- correct

\- repair

\- modernize

\- translate

\- reinterpret

\- replace

\- normalize away

material source wording.

If the source appears:

\- contradictory

\- technically unusual

\- inconsistent

\- possibly erroneous

\- legally unusual

preserve the source wording and meaning.

Do not silently repair the tender.

SOURCE WORDING PRESERVATION — STRICT RULE

If the source contains unusual or apparently incorrect terminology:

preserve that terminology exactly.

This rule applies particularly to:

\- requirement_text

\- source_quote

\- cell_text

You may make requirement_text concise,

but you MUST NOT replace a material source term with a technically more logical term.

Example:

If the source says:

SPEECH TO TEXT

while the surrounding context appears to describe another technology:

keep:

SPEECH TO TEXT

Do NOT replace it with another technical term.

Instead:

\- preserve the original source terminology

\- set requires_manual_review = true

\- reduce confidence where appropriate

\- explain the apparent inconsistency in review_reason

SOURCE FIDELITY OVERRIDES TECHNICAL KNOWLEDGE

Your technical knowledge must never override explicit tender wording.

The extraction represents what the tender says,

not what the tender probably intended to say.

ATOMIC REQUIREMENTS

Extract independently testable requirements as atomic requirements whenever possible.

An atomic requirement represents one independently testable condition.

Example:

Source:

"The bidder must have annual revenue of at least 5 million NIS and at least 20 employees."

Extract separately:

annual revenue requirement

and

employee-count requirement.

Do not combine independently testable requirements merely because they appear in one sentence, paragraph or table cell.

PARENT / CHILD STRUCTURE

When one source item contains multiple independently testable requirements:

create:

\- one parent requirement when useful for preserving the full source structure

\- atomic child requirements for each independently testable condition

Use:

parent_requirement_id

and where relevant:

condition_group_id

The parent preserves structure.

Children preserve independently testable requirements.

Do not evaluate a structural parent as an additional independent compliance requirement.

MANDATORY SUB-ITEM EXTRACTION

When the source contains:

\- numbered sub-items

\- bullet items

\- enumerated clauses

\- nested lists

\- several independently testable capabilities

\- multiple explicit obligations

extract every independently testable source item.

Do NOT replace an explicit source list with one generalized summary.

For an enumerated list:

every independently testable enumerated item must be represented.

If one enumerated item itself contains several independently testable requirements:

it may produce multiple atomic children.

NON-ENUMERATED CLAUSES

Independently testable requirements may also appear without numbering.

Inspect clauses joined by language such as:

and

or

including

as well as

וכן

וגם

לרבות

כולל

או

Do not split automatically merely because such a word appears.

Split only where the clauses represent genuinely independently testable requirements.

LOGICAL STRUCTURE

Use:

simple

all_of

any_of

conditional

simple:

one standalone requirement

all_of:

all relevant child requirements must be satisfied

any_of:

one or more alternatives may satisfy the source requirement

conditional:

the requirement applies only under a stated condition

Never convert:

OR into AND

or:

conditional into unconditional.

Preserve the legal and operational logic of the source.

QUALIFIERS

Use qualifier where appropriate:

each

all

any

exactly

at_least

at_most

Preserve exact scope.

Example:

Source:

"experience in each of the years 2023, 2024 and 2025"

Do not simplify this to:

"3 years of experience"

because that changes the meaning.

LEGAL AND SEMANTIC FIDELITY

Preserve:

\- actor

\- action

\- object

\- number

\- unit

\- date

\- period

\- threshold

\- scope

\- qualifier

\- exception

\- alternative

\- condition

\- logical relationship

Do not simplify any requirement if simplification changes its meaning.

REQUIREMENT TARGET

Use one of:

business_fact

submission_obligation

tender_metadata

evaluation_rule

post_award_obligation

business_fact:

A reusable structured fact about:

\- bidder

\- organization

\- personnel

\- product

\- service

\- system

\- experience

\- certification

\- qualification

\- capacity

\- capability

submission_obligation:

A document, signature, declaration, form or submission action required from the bidder.

tender_metadata:

Descriptive tender information that does not itself represent bidder compliance.

evaluation_rule:

A rule used by the tender authority to:

\- score

\- rank

\- evaluate

\- calculate quality

\- determine evaluation thresholds

\- determine progression between evaluation stages

post_award_obligation:

An obligation applying to the successful bidder after award or contract execution.

IMPORTANT DISTINCTION

Do NOT classify a technical capability as evaluation_rule merely because it is checked during evaluation.

Example:

"The proposed system must support API access."

This is normally:

requirement_target = business_fact

stage = evaluation

The capability itself is a fact about the proposed system.

The stage describes when it is assessed.

An evaluation rule is something such as:

"Proposals receiving less than 75 quality points will be rejected."

That is:

requirement_target = evaluation_rule

stage = evaluation

STAGE CLASSIFICATION

Use:

eligibility

pre_submission

submission

evaluation

post_award

eligibility:

Formal bidder threshold / participation conditions.

Examples:

\- financial threshold

\- bidder experience

\- bidder registration

\- mandatory bidder license

\- explicit תנאי סף

pre_submission:

Actions that must occur before formal submission but are not themselves part of the submission package.

submission:

Bid submission obligations.

evaluation:

Requirements assessed during:

\- technical evaluation

\- functional evaluation

\- quality evaluation

\- mandatory Go / No-Go evaluation

\- demonstration

\- testing

\- compliance review

post_award:

Obligations that apply after award or contract signature.

IMPORTANT:

A requirement is not an eligibility condition merely because failing it can ultimately cause proposal rejection.

TECHNICAL MANDATORY REQUIREMENTS

Mandatory technical and functional requirements assessed in a Go / No-Go technical stage normally use:

stage = evaluation

Their requirement_target depends on what the requirement describes.

A system capability normally maps to:

business_fact

An evaluation formula or scoring threshold normally maps to:

evaluation_rule

BUSINESS FACTS

Create business_fact_key only when the requirement corresponds to a meaningful reusable structured fact.

Examples:

annual_revenue

employee_count

maximum_supported_attachment_size_mb

has_required_license

system_supports_feature_x

Do not create misleading business facts for purely administrative or narrative requirements.

BUSINESS FACT TYPE

Use:

number

currency

boolean

date

enum

string

A business_fact_key does NOT automatically make the requirement code comparable.

EVIDENCE

Separate:

the underlying fact

from

the evidence required to prove it.

Use evidence_required for:

\- certificates

\- licenses

\- declarations

\- reports

\- references

\- confirmations

\- supporting documents

Do not confuse evidence with the underlying requirement.

COMPARISON OPERATORS

Use only:

\>

\>=

=

\<=

\<

between

required

in

not_in

COMPARISON SEMANTICS — STRICT RULE

Do NOT select comparison_operator only from literal tender wording.

comparison_operator must represent the future deterministic comparison between:

the structured business fact

and

the tender requirement.

Before assigning comparison_operator:

1\. Determine exactly what the source requires.

2\. Determine exactly what business_fact_key represents.

3\. Determine which business-fact values should satisfy the tender.

4\. Determine which business-fact values should fail the tender.

5\. Select the operator that produces those results.

CAPABILITY MINIMUMS

When the tender requires a product, service, organization or system to support a capability up to X:

and the business fact represents the MAXIMUM supported capability:

the business fact normally must be at least X.

Example:

Tender:

"The system must support attachments up to 40 MB."

Business fact:

maximum_supported_attachment_size_mb

Correct future comparison:

business_fact \>= 40

Test:

10 MB capability → FAIL

40 MB capability → PASS

50 MB capability → PASS

Therefore:

comparison_operator = "\>="

TRUE UPPER LIMITS

When the tender states that an actual measured or submitted value itself must not exceed X:

use:

\<= X

Example:

Tender:

"An uploaded individual file must not exceed 40 MB."

Business fact:

actual_uploaded_file_size_mb

Correct comparison:

business_fact \<= 40

MINIMUM THRESHOLDS

If compliance requires a fact to be at least X:

use:

\>= X

MAXIMUM THRESHOLDS

If compliance requires a fact not to exceed X:

use:

\<= X

EXACT VALUES

Use:

=

only when the source genuinely requires an exact value.

Do not use "=" merely because the source contains a specific number.

RANGES

For true ranges:

comparison_operator = between

value = lower bound

value_secondary = upper bound

NUMERIC SAFETY TEST

Before finalizing any numeric requirement:

mentally test:

\- a value below the threshold

\- the exact threshold

\- a value above the threshold

Verify that the chosen comparison_operator produces the correct compliance result.

If the result is reversed:

the operator is wrong.

AMBIGUOUS COMPARISON SEMANTICS

If it is unclear whether the numeric value represents:

\- minimum capability

\- maximum capability

\- allowed maximum

\- required minimum

\- actual measurement

\- source-side restriction

\- bidder-side capacity

do NOT guess.

Use:

comparison_operator = null

where allowed.

Set:

requires_manual_review = true

and explain the ambiguity in review_reason.

NUMERIC NORMALIZATION

Whenever the source contains a meaningful numeric condition:

extract:

value

value_secondary

unit

comparison_operator

Do not hide meaningful numeric thresholds only inside requirement_text.

PERIOD

Use period when the source defines a meaningful:

\- year

\- group of years

\- month

\- duration

\- historical period

\- contract period

\- validity period

Preserve exact source periods.

SCOPE

Use scope when the requirement applies to a specific:

\- population

\- service

\- system

\- channel

\- organizational unit

\- geography

\- account

\- role

\- object

\- time period

CONDITIONAL REQUIREMENTS

When a requirement applies only if a source condition is true:

use:

logic_type = conditional

and:

condition_text

Do not convert a conditional requirement into an unconditional requirement.

EXCEPTIONS

Use:

exception_text

for:

\- exceptions

\- alternatives

\- carve-outs

\- special cases

Do not omit exceptions that affect compliance.

DOCUMENT REQUIREMENTS

When the tender requires a specific document:

use:

requirement_type = document

and normally:

requirement_target = submission_obligation

unless the source clearly establishes otherwise.

DATES AND DEADLINES

Preserve exact dates.

Do not infer a greater-than or less-than relationship unless the source meaning clearly requires it.

VALIDITY

Use requirement_type = validity when the requirement concerns something being valid:

\- on a specific date

\- until a specific date

\- for a specified period

\- throughout a contract period

CODE COMPARABILITY — STRICT RULE

Set:

code_comparable = true

ONLY when TenderFit can safely compare the requirement deterministically against a trusted and independently known structured fact.

Do NOT use code_comparable = true merely because:

\- a boolean key can be created

\- the requirement sounds binary

\- the source uses yes/no wording

\- a technical capability can be named as a business fact

Technical capabilities often require:

\- demonstration

\- documentation

\- product testing

\- API testing

\- integration verification

\- technical review

\- human review

Examples normally requiring manual verification include:

\- APIs

\- RBAC

\- logging

\- reporting

\- accessibility

\- WhatsApp

\- UI functionality

\- integration behavior

\- protocol behavior

\- system architecture

\- cybersecurity functionality

\- export behavior

\- message-delivery behavior

Unless a trusted independently verified structured fact already exists:

code_comparable = false

and normally:

requires_manual_review = true

PARENT / CHILD COMPARISON

A structural parent should normally use:

code_comparable = false

Do not evaluate both:

the structural parent

and

all of its atomic children

as separate independent compliance conditions.

Avoid double counting.

REQUIREMENT TYPE

Use the most appropriate type:

threshold

boolean

enum

date

validity

document

qualitative

administrative

technical

financial

personnel

other

CRITICALITY

Set:

is_critical = true

when failure may cause:

\- bidder disqualification

\- proposal rejection

\- mandatory technical Go / No-Go failure

\- quality threshold failure

\- proposal not progressing

\- inability to receive contract award

\- inability to complete contracting

Do not mark every requirement critical automatically.

Mandatory technical Go / No-Go requirements are normally critical.

SOURCE EVIDENCE

Include source evidence whenever reliably available:

source_page

source_section

source_quote

source_type

table_id

row_index

column_index

cell_text

source_quote must directly support the extracted requirement.

Never fabricate source_quote.

Do not silently rewrite source_quote.

TABLES

Tables are high-risk extraction areas.

When extracting from a table:

preserve when reliable:

table_id

row_index

column_index

cell_text

Do not guess row or column values.

If the table structure is unclear:

set:

requires_manual_review = true

COMPLETENESS — PRIMARY OBJECTIVE

When the user requests a page range or region:

extract ALL requirement-bearing content inside that requested scope.

Do NOT depend on a predefined count of source rows.

Do NOT assume how many requirements should exist before reading the source.

Instead:

discover the complete requirement set from the source itself.

For every source item:

1\. Read the complete source text.

2\. Identify every independently testable requirement.

3\. Identify every enumerated sub-item.

4\. Identify every bullet.

5\. Identify every numeric threshold.

6\. Identify every unit.

7\. Identify every date.

8\. Identify every qualifier.

9\. Identify every exception.

10\. Identify every condition.

11\. Identify every AND / OR relationship.

12\. Verify that all requirement-bearing content is represented.

NO PREDEFINED ROW DEPENDENCY

Source row numbers may be used only as traceability metadata when they are clearly visible in the tender.

Do NOT use row numbers as instructions about what the tender is supposed to contain.

Do NOT assume:

\- a fixed first row

\- a fixed final row

\- a fixed number of rows

\- a fixed number of requirements

The source itself determines completeness.

ENUMERATED LIST COMPLETENESS

When a source item contains an enumerated list:

count the source items.

Verify that every independently testable source item is represented.

Do not replace enumerated content with a broad summary.

SOURCE-REGION COMPLETENESS GATE

Before final output:

re-read the COMPLETE requested source region.

Verify:

\- every table row containing a requirement is represented

\- every numbered item is represented

\- every bullet item is represented

\- every independently testable clause is represented

\- every material numeric value is represented

\- every material condition is represented

\- every exception is represented

\- no requirement-bearing text was skipped

Do not finalize if requirement-bearing source content remains unrepresented.

ANTI-HALLUCINATION

Never invent:

\- requirements

\- numbers

\- dates

\- thresholds

\- licenses

\- certifications

\- page numbers

\- section numbers

\- quotes

\- business facts

\- logical relationships

\- table structure

If information is missing:

use null where allowed.

If uncertain:

reduce confidence

and/or:

requires_manual_review = true

Do not guess.

OUTPUT COMPRESSION — REMOVE REDUNDANCY ONLY

Reduce unnecessary repetition to keep structured output efficient.

For parent requirements:

cell_text may contain the complete source table cell.

For atomic child requirements:

normally use:

cell_text = null

because the full cell is already preserved in the parent.

For child source_quote:

use the smallest exact source fragment that directly supports the child requirement.

Do NOT repeat an entire long parent source cell in every child.

Do NOT repeat long parent wording inside every child requirement_text.

Compression may remove redundancy only.

Compression must NEVER remove:

\- requirements

\- atomic children

\- numbers

\- units

\- logic

\- qualifiers

\- conditions

\- exceptions

\- source page

\- row mapping

\- source quote

MANDATORY FINAL VERIFICATION PASS

Before returning the final structured output:

perform a complete verification pass over the entire requested source region.

Verify:

1\. Every requirement-bearing source item is represented.

2\. Every enumerated source item is represented.

3\. Every independently testable source clause is represented.

4\. Numeric values are correct.

5\. Units are correct.

6\. Comparison semantics are correct.

7\. Conditions are preserved.

8\. Exceptions are preserved.

9\. AND / OR relationships are preserved.

10\. Source terminology has not been silently corrected.

11\. Source evidence supports every extracted requirement.

12\. No unsupported requirement was invented.

13\. No requirement was omitted merely to reduce output length.

14\. The final structured output fully covers the requested source region.

SOURCE TERMINOLOGY FINAL CHECK

Before final output:

compare every unusual technical term in requirement_text against source_quote.

If a material technical term differs from the source:

restore the source term.

If the source appears erroneous:

preserve it,

set requires_manual_review = true,

and explain the issue.

Never silently correct the tender.

DO NOT COMPARE TO A BIDDER

Never output:

\- bidder complies

\- bidder does not comply

\- eligible

\- not eligible

\- Go

\- No-Go

This agent only extracts and normalizes requirements.

HUMAN DECISION

The final participation decision belongs to a human.

OUTPUT

Return only the configured structured output.

Do not add explanatory prose outside the schema.

Preserve Hebrew source wording where the source is Hebrew.

Do not translate unless explicitly requested.

Accuracy, completeness, semantic fidelity, source fidelity, logical fidelity and traceability are more important than brevity or speed.

# 4. Structured Output Schema — FULL V3.5

זהו ה-Schema שאיתו ה-Extractor נבדק. אין לשנות שמות שדות, enums או required fields ללא גרסה חדשה ובדיקת Regression.

{

"type": "object",

"properties": {

"requirements": {

"type": "array",

"items": {

"type": "object",

"properties": {

"requirement_id": {"type":"string"},

"category":{"type":"string"},

"requirement_type":{

"type":"string",

"enum":\["threshold","boolean","enum","date","validity","document","qualitative","administrative","technical","financial","personnel","other"\]

},

"requirement_text":{"type":"string"},

"requirement_target":{

"type":"string",

"enum":\["business_fact","submission_obligation","tender_metadata","evaluation_rule","post_award_obligation"\]

},

"stage":{

"type":"string",

"enum":\["eligibility","pre_submission","submission","evaluation","post_award"\]

},

"logic_type":{

"type":"string",

"enum":\["simple","all_of","any_of","conditional"\]

},

"parent_requirement_id":{"type":"string","nullable":true},

"condition_group_id":{"type":"string","nullable":true},

"qualifier":{

"type":"string",

"nullable":true,

"enum":\["each","all","any","exactly","at_least","at_most"\]

},

"value":{"type":"string","nullable":true},

"value_secondary":{"type":"string","nullable":true},

"unit":{"type":"string","nullable":true},

"comparison_operator":{

"type":"string",

"nullable":true,

"enum":\["\>","\>=","=","\<=","\<","between","required","in","not_in"\]

},

"period":{"type":"string","nullable":true},

"scope":{"type":"string","nullable":true},

"condition_text":{"type":"string","nullable":true},

"exception_text":{"type":"string","nullable":true},

"business_fact_key":{"type":"string","nullable":true},

"business_fact_type":{

"type":"string",

"nullable":true,

"enum":\["number","currency","boolean","date","enum","string"\]

},

"evidence_required":{"type":"array","items":{"type":"string"}},

"source_page":{"type":"integer","nullable":true},

"source_section":{"type":"string","nullable":true},

"source_quote":{"type":"string","nullable":true},

"source_type":{

"type":"string",

"enum":\["paragraph","table","heading","appendix","form","unknown"\]

},

"table_id":{"type":"string","nullable":true},

"row_index":{"type":"integer","nullable":true},

"column_index":{"type":"integer","nullable":true},

"cell_text":{"type":"string","nullable":true},

"confidence":{"type":"string","enum":\["high","medium","low"\]},

"requires_manual_review":{"type":"boolean"},

"review_reason":{"type":"string","nullable":true},

"is_critical":{"type":"boolean"},

"code_comparable":{"type":"boolean"}

},

"required":\[

"requirement_id","category","requirement_type","requirement_text",

"requirement_target","stage","logic_type","parent_requirement_id",

"condition_group_id","qualifier","value","value_secondary","unit",

"comparison_operator","period","scope","condition_text","exception_text",

"business_fact_key","business_fact_type","evidence_required",

"source_page","source_section","source_quote","source_type","table_id",

"row_index","column_index","cell_text","confidence",

"requires_manual_review","review_reason","is_critical","code_comparable"

\]

}

}

},

"required":\["requirements"\]

}

# 5. User Prompt — Benchmark Region Extraction V3.5

ה-Prompt הבא הוא Prompt ה-Benchmark ששימש באזור הבדיקה. חשוב: בעבודה על ה-Extractor עצמו הועברו אליו גבולות האזור (Region/Pages), אבל גבולות אלה **לא הוזנו ידנית בשלב ה-Requirement Mapping**; ה-Mapper קיבל קודם את המכרז המלא וזיהה בעצמו את האזור. בפרודקשן ה-Requirement Mapper אמור לספק ל-Extractor את גבולות האזור באופן דינמי. יתר כללי השלמות צריכים להישמר.

Analyze ALL requirement-bearing content in the following region of the attached tender.

Region:

נספח 1, סעיף 1 — דרישות חובה

Pages:

25–28

IMPORTANT:

Analyze the COMPLETE content of pages 25–28.

Do NOT rely on a predefined number of source rows.

Do NOT assume how many rows, requirements, sub-items or atomic requirements exist.

The tender source itself determines the complete requirement set.

REGION CONTEXT

This region contains mandatory technical and functional requirements evaluated as part of a technical Go / No-Go evaluation stage.

These requirements are not bidder eligibility threshold conditions merely because failure may cause rejection.

QUALITY PRIORITY

Accuracy, completeness, semantic fidelity and source fidelity are more important than speed or brevity.

Take as much reasoning time as necessary.

TASK

1\. Read ALL content on pages 25–28.

2\. Identify ALL requirement-bearing content within these pages.

3\. Extract every mandatory requirement contained in the requested region.

4\. Do not skip:

\- numbered rows

\- table rows

\- numbered sub-items

\- bullet items

\- nested items

\- independent clauses

\- numeric thresholds

\- technical capabilities

\- functional capabilities

\- conditions

\- exceptions

\- alternatives

\- qualifiers

5\. Treat every independently testable source condition as a candidate atomic requirement.

6\. Where one source item contains multiple independently testable requirements:

create a parent requirement where useful,

and create separate atomic child requirements.

7\. Preserve:

\- AND logic

\- OR logic

\- conditional logic

\- alternatives

\- exceptions

\- qualifiers

\- applicability conditions

\- numeric meaning

8\. Do not summarize several independently testable requirements into one generalized requirement.

ENUMERATED CONTENT

9\. Whenever the source contains a numbered or enumerated list:

extract every independently testable item.

10\. Before finalizing an enumerated source item:

count the source sub-items

and verify that every independently testable sub-item has been represented.

11\. If one enumerated sub-item itself contains several independently testable requirements:

split it further when necessary.

TECHNICAL REQUIREMENT CLASSIFICATION

12\. Mandatory technical and functional requirements in this region normally use:

stage = "evaluation"

13\. Do NOT classify a technical capability as:

requirement_target = "evaluation_rule"

merely because it is evaluated during the evaluation stage.

A capability of the proposed product or system normally represents:

requirement_target = "business_fact"

while:

stage = "evaluation"

Use evaluation_rule only for actual evaluation logic such as:

\- scoring formulas

\- evaluation thresholds

\- ranking rules

\- quality-score rules

\- progression rules

CODE COMPARABILITY

14\. Apply the strict code_comparable rules from the System Instructions.

15\. Do not mark a technical capability code_comparable = true merely because a boolean business_fact_key can be created.

16\. Where a technical capability requires:

\- demonstration

\- testing

\- documentation review

\- integration review

\- technical review

\- human verification

normally use:

code_comparable = false

and:

requires_manual_review = true

NUMERIC REQUIREMENTS

17\. Extract every meaningful numeric requirement into:

value

value_secondary

unit

comparison_operator

18\. Do not choose comparison_operator only from the literal tender wording.

19\. Determine what the related business_fact_key represents.

20\. Determine which business-fact values should PASS.

21\. Determine which business-fact values should FAIL.

22\. Select comparison_operator accordingly.

23\. For every numeric comparison:

test mentally:

\- a value below the threshold

\- the exact threshold

\- a value above the threshold

Verify that the structured operator preserves the intended compliance meaning.

24\. If the numeric comparison direction remains ambiguous:

do not guess.

Set:

comparison_operator = null

where allowed,

requires_manual_review = true

and explain the ambiguity in review_reason.

SOURCE FIDELITY

25\. Preserve unusual, suspicious or apparently incorrect source terminology.

26\. Never silently correct technical terminology.

27\. If source wording appears technically inconsistent:

\- preserve the exact material source term

\- set requires_manual_review = true

\- reduce confidence where appropriate

\- explain the issue in review_reason

28\. requirement_text must not replace a material source term with a technically more logical alternative.

29\. source_quote must contain exact source wording.

SOURCE TRACEABILITY

30\. Include source evidence whenever reliably available:

source_page

source_section

source_quote

source_type

table_id

row_index

column_index

cell_text

31\. row_index may be used only when the row number is reliably visible in the source.

32\. Do not invent row numbering.

OUTPUT COMPRESSION

33\. Avoid unnecessary repetition.

34\. Parent requirements may contain the full table-cell text in:

cell_text

35\. Atomic children should normally use:

cell_text = null

when the full source cell is already preserved by the parent.

36\. For atomic children:

use the smallest exact source fragment necessary in:

source_quote

37\. Do not duplicate an entire long parent source cell inside every child.

38\. Compression may remove redundancy only.

Never remove:

\- requirements

\- atomic children

\- logic

\- numeric values

\- conditions

\- exceptions

\- source evidence

MANDATORY COMPLETE-REGION VERIFICATION

Before returning the final structured output:

re-read ALL pages 25–28 from beginning to end.

Then verify:

A. Every requirement-bearing table row is represented.

B. Every numbered source item is represented.

C. Every enumerated sub-item is represented.

D. Every bullet item containing a requirement is represented.

E. Every independently testable clause is represented.

F. Every meaningful numeric value and unit is represented.

G. Every AND / OR relationship is preserved.

H. Every condition is preserved.

I. Every exception is preserved.

J. Every material source term is preserved.

K. No source terminology was silently corrected.

L. No unsupported requirement was invented.

M. No requirement-bearing content from pages 25–28 was omitted.

N. No requirement from outside pages 25–28 was extracted.

Do NOT stop after reaching an assumed number of source rows.

Do NOT use a predefined expected requirement count.

The source itself determines when the requested region has been fully extracted.

Return only the configured structured output.

Experiment version:

V3.5 Region Extraction — Full Page Range — Generic Completeness

# 6. מיפוי מדויק מ-AI Studio ל-API

| **ערך**                                                                           | **פרמטר**                |
|-----------------------------------------------------------------------------------|--------------------------|
| API model="gemini-3.1-pro-preview"                                                | AI Studio Model          |
| system_instruction=\<FULL SYSTEM_INSTRUCTIONS_V3_5\>                              | System instructions      |
| input item type=text                                                              | User prompt              |
| input item type=document עם URI מה-Files API                                      | Attached PDF             |
| generation_config.thinking_level="high"                                           | Thinking = High          |
| generation_config.temperature=0.1                                                 | Temperature = 0.1        |
| response_format.type="text", mime_type="application/json", schema=\<FULL SCHEMA\> | Structured Outputs = ON  |
| לא להעביר google_search tool                                                      | Search OFF               |
| לא להעביר url_context tool                                                        | URL Context OFF          |
| לא להעביר code_execution tool                                                     | Code Execution OFF       |
| לא להעביר function declarations/tools                                             | Function Calling OFF     |
| אין previous_interaction_id                                                       | Single request extractor |
| store=false                                                                       | Minimize retention       |

# 7. Python — Reference Implementation

הקוד הבא מציג את המבנה המדויק של הקריאה. לצורך תחזוקה נכונה, מומלץ לשמור את System Instructions, User Prompt וה-Schema כקבצי version-controlled נפרדים בקוד, אך התוכן שלהם חייב להיות זהה לנספחים במסמך זה.

from google import genai

import json

MODEL = "gemini-3.1-pro-preview"

TEMPERATURE = 0.1

THINKING_LEVEL = "high"

\# Keep these version-controlled and immutable for the validated baseline.

SYSTEM_INSTRUCTION = SYSTEM_INSTRUCTIONS_V3_5

USER_PROMPT = USER_PROMPT_V3_5

SCHEMA = EXTRACTOR_SCHEMA_V3_5

client = genai.Client(api_key=GEMINI_API_KEY)

\# Recommended for tender PDFs that may be reused or are large.

tender_file = client.files.upload(file="path/to/tender.pdf")

interaction = client.interactions.create(

model=MODEL,

system_instruction=SYSTEM_INSTRUCTION,

input=\[

{"type": "text", "text": USER_PROMPT},

{

"type": "document",

"uri": tender_file.uri,

"mime_type": tender_file.mime_type,

},

\],

generation_config={

"thinking_level": THINKING_LEVEL,

"temperature": TEMPERATURE,

\# Set only after measuring the largest validated output.

\# "max_output_tokens": 65536,

},

response_format={

"type": "text",

"mime_type": "application/json",

"schema": SCHEMA,

},

\# No tools are passed: Search, URL Context, Code Execution and

\# Function Calling remain disabled for the extractor baseline.

store=False,

)

if interaction.status != "completed":

raise RuntimeError(f"Gemini interaction did not complete: {interaction.status}")

result = json.loads(interaction.output_text)

\# Application-side validation is still mandatory.

\# Validate result against SCHEMA before storing it in the database.

print(json.dumps(result, ensure_ascii=False, indent=2))

# 8. REST — Request Structure

POST https://generativelanguage.googleapis.com/v1beta/interactions

Headers:

x-goog-api-key: \<GEMINI_API_KEY\>

Content-Type: application/json

Body (logical structure):

{

"model": "gemini-3.1-pro-preview",

"system_instruction": "\<FULL V3.5 SYSTEM INSTRUCTIONS\>",

"input": \[

{

"type": "text",

"text": "\<FULL V3.5 USER PROMPT\>"

},

{

"type": "document",

"uri": "\<URI RETURNED BY GEMINI FILES API\>",

"mime_type": "application/pdf"

}

\],

"generation_config": {

"thinking_level": "high",

"temperature": 0.1

},

"response_format": {

"type": "text",

"mime_type": "application/json",

"schema": \<FULL V3.5 JSON SCHEMA\>

},

"store": false

}

# 9. טיפול בקבצי PDF

- PDF ניתן להעביר כ-document input. לפי תיעוד Google, PDF מוגבל ל-50MB בשיטות הקלט הרלוונטיות.

- למסמך גדול/לשימוש חוזר יש להשתמש ב-Files API ולהעביר את ה-uri שקיבלנו בתוך input.

- אין לבצע OCR חיצוני אוטומטי כברירת מחדל; המטרה היא לתת למודל את המסמך המקורי ולשמור על מבנה, טבלאות והקשר.

- בפרודקשן יש לשמור hash של קובץ המקור ו-version של Extractor לצד התוצאה כדי לאפשר audit ו-reprocessing.

# 10. כללי פרודקשן מחייבים

- Version Lock: לשמור extractor_version="v3.5" בכל תוצאה.

- Model Lock: לשמור את שם המודל בפועל בכל ריצה. המודל הנוכחי הוא Preview ועלול להשתנות/להיעלם בעתיד.

- Schema Validation: לא להכניס JSON למסד לפני אימות מול ה-Schema.

- Retry: לבצע Retry רק בשגיאת API/timeout/response incomplete; לא “לתקן” את JSON ידנית תוך כדי Retry.

- Completeness: אם output נקטע או interaction.status אינו completed — הריצה נחשבת כשל ולא תוצאה חלקית תקינה.

- Traceability: לשמור source_page/source_quote ושדות המקור כדי לאפשר הצגה למשתמש וביקורת.

- No silent model upgrade: מעבר מ-gemini-3.1-pro-preview למודל אחר דורש Regression Test.

- No silent prompt/schema changes: כל שינוי מעלה גרסת Extractor.

- Privacy: להשתמש ב-store=false אם אין צורך ב-state של Interactions; לשמור API key ב-secret manager ולא בקוד.

# 11. Validation של פלט בצד השרת

Structured Outputs מכריח את צורת ה-JSON, אך אינו מבטיח שהערכים סמנטית נכונים. לכן לאחר json.loads יש לבצע לפחות: JSON Schema validation; בדיקת requirement_id ייחודי; parent_requirement_id קיים אם אינו null; validation של numeric fields; בדיקה שאין parent שמסומן code_comparable=true ללא סיבה; ורישום warning לכל requires_manual_review=true.

# 12. החלטת Temperature וחשיבה

Thinking level: high. Gemini 3.1 Pro תומך ב-low, medium, high וברירת המחדל שלו high; אנחנו מציינים high במפורש לצורך reproducibility של ה-Baseline.

Temperature: 0.1. למרות שהמלצת Google הכללית למודלי Gemini 3 היא 1.0, הניסוי שלנו השווה 1.0, 0.1 ו-0.0, וה-Baseline שנבחר ל-Extractor הוא 0.1. אין לשנות אותו בפרודקשן הראשון בלי Benchmark מחדש.

# 13. תוצאות שאמורות לשמש Regression Gate

| **ערך**                                               | **פרמטר**                     |
|-------------------------------------------------------|-------------------------------|
| 100%                                                  | Coverage — Region 6 benchmark |
| 0                                                     | Missing source requirements   |
| 0                                                     | FAIL                          |
| 0                                                     | UNSUPPORTED                   |
| High confidence                                       | Source scope discovery        |
| Correct: \>= 40 for maximum supported capability      | 40MB comparison semantics     |
| Preserved; manual review instead of silent correction | Suspicious source terminology |

Regression Gate מומלץ: כל שינוי במודל/Prompt/Schema/Temperature חייב לפחות לשמור על 100% coverage, 0 critical hallucinations, 0 missing critical source requirements, ו-100% דיוק בערכים מספריים קריטיים בקורפוס המאומת.

# 14. מקורות API רשמיים שנבדקו

https://ai.google.dev/gemini-api/docs/interactions-overview

https://ai.google.dev/api/interactions-api

https://ai.google.dev/gemini-api/docs/structured-output

https://ai.google.dev/gemini-api/docs/thinking

https://ai.google.dev/gemini-api/docs/file-input-methods

https://ai.google.dev/gemini-api/docs/gemini-3

# 15. כלל שינוי גרסה

כל שינוי באחד מארבעת המרכיבים הבאים יוצר Extractor Version חדש: System Instructions, User Prompt core rules, Structured Output Schema, Model/Generation parameters. אין לעדכן אחד מהם “בשקט” בפרודקשן.
