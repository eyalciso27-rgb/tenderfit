import os, json, pathlib, datetime, hashlib, time, traceback
from google import genai

ROOT=pathlib.Path(r"C:\Users\eyal\TenderFit_Mapper_Test")
EXT=ROOT/"extractor"/"v3.5-clean"
SOURCE=ROOT/"source"/"tender_2_2025.pdf"
RUN_DIR=ROOT/"extractor_runs"/"v3.5-clean_final_validation"
RUN_DIR.mkdir(parents=True,exist_ok=True)

def load_key():
    key=os.getenv("GEMINI_API_KEY")
    if not key:
        env=ROOT/".env"
        for line in env.read_text(encoding="utf-8").splitlines():
            line=line.strip()
            if line and not line.startswith("#") and "=" in line:
                k,v=line.split("=",1)
                if k.strip()=="GEMINI_API_KEY":
                    key=v.strip().strip('"').strip("'")
                    break
    if not key: raise RuntimeError("GEMINI_API_KEY not found")
    return key

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

sys_prompt=(EXT/"system_instructions.txt").read_text(encoding="utf-8")
user_prompt=(EXT/"user_prompt.txt").read_text(encoding="utf-8")
schema=json.loads((EXT/"structured_output_schema.json").read_text(encoding="utf-8"))
settings=json.loads((EXT/"settings.json").read_text(encoding="utf-8"))
required=set(schema["properties"]["requirements"]["items"]["required"])

def gate(data):
    reqs=data.get("requirements",[])
    ids=[r.get("requirement_id") for r in reqs]
    idset=set(ids)
    rows={r.get("row_index") for r in reqs if isinstance(r.get("row_index"),int)}
    pages=[r.get("source_page") for r in reqs if isinstance(r.get("source_page"),int)]
    def rs(n): return [r for r in reqs if r.get("row_index")==n]
    def pc(n,min_children):
        x=rs(n)
        parents=[r for r in x if r.get("logic_type")=="all_of" and r.get("parent_requirement_id") is None]
        if not parents:return False
        pids={r["requirement_id"] for r in parents}
        return sum(1 for r in x if r.get("parent_requirement_id") in pids)>=min_children

    technical_safety_candidates=[
      r for r in reqs
      if r.get("requirement_type")=="technical"
      and r.get("logic_type")=="simple"
      and r.get("business_fact_type") in {"boolean","string","enum"}
      and r.get("code_comparable") is False
    ]
    technical_safety_bad=[
      r for r in technical_safety_candidates if r.get("requires_manual_review") is not True
    ]
    speech=[
      r for r in reqs
      if "SPEECH TO TEXT" in ((r.get("requirement_text") or "")+" "+(r.get("source_quote") or ""))
    ]
    row31=rs(31)
    row31_parents=[r for r in row31 if r.get("logic_type")=="all_of" and r.get("parent_requirement_id") is None]
    row31_pids={r["requirement_id"] for r in row31_parents}
    row31_children=[r for r in row31 if r.get("parent_requirement_id") in row31_pids]
    row31_keys=[(r.get("business_fact_key") or "").lower() for r in row31_children]
    checks={
      "nonempty_output":len(reqs)>0,
      "schema_required_fields":all(not(required-set(r.keys())) for r in reqs),
      "unique_ids":len(ids)==len(idset),
      "valid_parent_refs":all(r.get("parent_requirement_id") is None or r.get("parent_requirement_id") in idset for r in reqs),
      "parents_not_code_comparable":all(not(r.get("code_comparable") is True) for r in reqs if r.get("logic_type") in {"all_of","any_of"} and r.get("parent_requirement_id") is None),
      "all_rows_1_36":all(n in rows for n in range(1,37)),
      "pages_25_28_only":all(25<=p<=28 for p in pages),
      "source_quotes_present":all(bool((r.get("source_quote") or "").strip()) for r in reqs),
      "40mb_semantics":any(str(r.get("value"))=="40" and r.get("comparison_operator")==">=" and str(r.get("unit") or "").upper()=="MB" for r in reqs),
      "speech_to_text_manual":any(r.get("requires_manual_review") is True for r in speech),
      "row17_parent_child":pc(17,3),
      "row23_log_7_children":pc(23,7),
      "row31_whatsapp_chat_atomic":bool(row31_parents) and len(row31_children)>=2 and any("whatsapp" in k for k in row31_keys) and any(("chat" in k or "conversation" in k) for k in row31_keys),
      "row35_smtp_api_atomic":pc(35,2),
      "technical_manual_review_safety":len(technical_safety_candidates)>0 and len(technical_safety_bad)==0,
    }
    return {
      "pass":all(checks.values()),
      "checks":checks,
      "requirement_count":len(reqs),
      "technical_safety_candidates":len(technical_safety_candidates),
      "technical_safety_bad_count":len(technical_safety_bad),
      "technical_safety_bad_ids":[r.get("requirement_id") for r in technical_safety_bad[:20]],
    }

client=genai.Client(api_key=load_key())
uploaded=None
for uattempt in range(1,4):
    try:
        uploaded=client.files.upload(file=str(SOURCE))
        break
    except Exception as e:
        (RUN_DIR/f"upload_error_{uattempt}.txt").write_text(traceback.format_exc(),encoding="utf-8")
        if uattempt==3: raise
        time.sleep(5*uattempt)

results=[]
accepted=None
for attempt in range(1,4):
    adir=RUN_DIR/f"attempt_{attempt:02d}"
    adir.mkdir(exist_ok=True)
    try:
        interaction=client.interactions.create(
            model=settings["model"],
            system_instruction=sys_prompt,
            input=[
              {"type":"document","uri":uploaded.uri,"mime_type":uploaded.mime_type},
              {"type":"text","text":user_prompt}
            ],
            generation_config={
              "thinking_level":settings["thinking_level"],
              "temperature":settings["temperature"]
            },
            response_format=[{"type":"text","mime_type":"application/json","schema":schema}],
            store=False
        )
        raw=interaction.output_text
        (adir/"response_raw.json").write_text(raw,encoding="utf-8")
        data=json.loads(raw)
        (adir/"response.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
        g=gate(data)
        rec={"attempt":attempt,"status":"completed","interaction_status":str(interaction.status),**g}
        (adir/"gate.json").write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding="utf-8")
        results.append(rec)
        if g["pass"]:
            accepted=attempt
            break
    except Exception as e:
        rec={"attempt":attempt,"status":"api_or_parse_error","error_type":type(e).__name__,"error":str(e)}
        (adir/"error.txt").write_text(traceback.format_exc(),encoding="utf-8")
        results.append(rec)
    if attempt<3: time.sleep(5)

summary={
 "generated_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "extractor_version":"v3.5-clean",
 "model":settings["model"],
 "thinking_level":settings["thinking_level"],
 "temperature":settings["temperature"],
 "accepted_attempt":accepted,
 "overall_pass":accepted is not None,
 "attempts":results,
 "runtime_hashes":{
  "system_sha256":sha(EXT/"system_instructions.txt"),
  "user_sha256":sha(EXT/"user_prompt.txt"),
  "schema_sha256":sha(EXT/"structured_output_schema.json"),
  "settings_sha256":sha(EXT/"settings.json")
 }
}
(RUN_DIR/"FINAL_VALIDATION_SUMMARY.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(summary,ensure_ascii=False,indent=2))
sys.exit(0 if accepted is not None else 2)
