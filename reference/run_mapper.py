import os, json, pathlib, datetime
from google import genai

ROOT = pathlib.Path(r"C:\Users\eyal\TenderFit_Mapper_Test")
VERSION = os.getenv("MAPPER_VERSION", "v1.0")
MAPPER_DIR = ROOT / "mapper" / VERSION
SOURCE = ROOT / "source" / os.getenv("MAPPER_SOURCE", "tender_2_2025.pdf")
RUNS_DIR = ROOT / "runs"

def load_key():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        env_file = ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, value = line.split("=", 1)
                if name.strip() == "GEMINI_API_KEY":
                    key = value.strip().strip('"').strip("'")
                    break
    if not key:
        raise RuntimeError("GEMINI_API_KEY was not found in environment or .env")
    return key

def next_run_dir():
    existing = sorted([p for p in RUNS_DIR.glob("run_*") if p.is_dir()])
    n = len(existing) + 1
    d = RUNS_DIR / ("run_%03d" % n)
    d.mkdir(parents=True, exist_ok=False)
    return d, n

def estimate_cost(usage):
    inp = int(getattr(usage, "total_input_tokens", 0) or 0)
    out = int(getattr(usage, "total_output_tokens", 0) or 0)
    thought = int(getattr(usage, "total_thought_tokens", 0) or 0)
    if inp <= 200000:
        input_rate = 2.0
        output_rate = 12.0
    else:
        input_rate = 4.0
        output_rate = 18.0
    cost = inp / 1000000 * input_rate + (out + thought) / 1000000 * output_rate
    return {
        "total_input_tokens": inp,
        "total_output_tokens": out,
        "total_thought_tokens": thought,
        "total_tokens": int(getattr(usage, "total_tokens", 0) or 0),
        "estimated_cost_usd": round(cost, 6),
        "pricing_assumption": {
            "input_usd_per_million": input_rate,
            "output_and_thought_usd_per_million": output_rate,
            "note": "Conservative estimate; actual billing may differ due to caching or billing implementation."
        }
    }

def cumulative_previous_cost():
    total = 0.0
    for p in RUNS_DIR.glob("run_*/usage.json"):
        try:
            total += float(json.loads(p.read_text(encoding="utf-8")).get("estimated_cost_usd", 0))
        except Exception:
            pass
    return total

def main():
    run_dir, run_no = next_run_dir()
    sys_prompt = (MAPPER_DIR / "system_instructions.txt").read_text(encoding="utf-8")
    user_prompt = (MAPPER_DIR / "user_prompt.txt").read_text(encoding="utf-8")
    schema = json.loads((MAPPER_DIR / "structured_output_schema.json").read_text(encoding="utf-8"))
    settings = json.loads((MAPPER_DIR / "settings.json").read_text(encoding="utf-8"))

    before = cumulative_previous_cost()
    cap = float(settings.get("cost_cap_usd", 2.0))
    if before >= cap:
        raise RuntimeError("Cost cap already reached")

    client = genai.Client(api_key=load_key())
    uploaded = client.files.upload(file=str(SOURCE))

    request_meta = {
        "run_id": "run_%03d" % run_no,
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "mapper_version": VERSION,
        "model": settings["model"],
        "thinking_level": settings["thinking_level"],
        "temperature": settings["temperature"],
        "source_file": str(SOURCE),
        "uploaded_file_uri": uploaded.uri,
        "system_instructions_file": str(MAPPER_DIR / "system_instructions.txt"),
        "user_prompt_file": str(MAPPER_DIR / "user_prompt.txt"),
        "schema_file": str(MAPPER_DIR / "structured_output_schema.json"),
        "cost_before_run_usd": round(before, 6),
        "cost_cap_usd": cap
    }
    (run_dir / "request.json").write_text(json.dumps(request_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    interaction = client.interactions.create(
        model=settings["model"],
        system_instruction=sys_prompt,
        input=[
            {"type": "document", "uri": uploaded.uri, "mime_type": uploaded.mime_type},
            {"type": "text", "text": user_prompt}
        ],
        generation_config={
            "thinking_level": settings["thinking_level"],
            "temperature": settings["temperature"]
        },
        response_format=[
            {
                "type": "text",
                "mime_type": "application/json",
                "schema": schema
            }
        ],
        store=False
    )

    raw_text = interaction.output_text
    (run_dir / "response_raw.json").write_text(raw_text, encoding="utf-8")
    try:
        parsed = json.loads(raw_text)
        (run_dir / "response.json").write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        (run_dir / "parse_error.txt").write_text(repr(e), encoding="utf-8")

    usage = estimate_cost(interaction.usage)
    usage["cost_before_run_usd"] = round(before, 6)
    usage["cumulative_estimated_cost_usd"] = round(before + usage["estimated_cost_usd"], 6)
    usage["cost_cap_usd"] = cap
    (run_dir / "usage.json").write_text(json.dumps(usage, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "run": request_meta["run_id"],
        "status": str(interaction.status),
        "usage": usage,
        "output_path": str(run_dir / "response.json")
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
