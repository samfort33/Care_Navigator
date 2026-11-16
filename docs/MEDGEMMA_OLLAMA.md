# Local MedGemma with Ollama

CareNavigator can route clinical text triage and supported clinical photos to a MedGemma model served by Ollama. The existing deterministic red-flag rules, guideline retrieval, schema validation, and clinician-review workflow remain in front of and around model output.

## Set up on Windows

1. Install Ollama from [ollama.com/download](https://ollama.com/download) and start it.
2. In PowerShell, download the 4B model:

   ```powershell
   ollama pull medgemma:4b
   ```

   The Ollama library lists this multimodal model at about 3.3 GB. Larger variants require substantially more memory and disk space.
3. In the project `.env.local` (or `.env`), set:

   ```dotenv
   AI_ASSESSMENT_PROVIDER="ollama"
   OLLAMA_BASE_URL="http://127.0.0.1:11434"
   OLLAMA_MODEL="medgemma:4b"
   OLLAMA_TIMEOUT_MS="120000"
   ```

4. Restart CareNavigator with `npm run dev` and confirm the health endpoint reports `LOCAL_OLLAMA_CONFIGURED` at `/api/health`.

CareNavigator calls Ollama's local `/api/chat` endpoint directly. Open WebUI is optional and is not required to use the CareNavigator interface. Keep Ollama bound to loopback; its local API does not require authentication by default.

## Supported integration

- Triage sends the server's de-identified intake and retrieved, sanitized guideline passages. EHR context is included only when the existing patient consent setting allows it.
- Clinical photo analysis accepts JPEG and PNG. Lab PDFs, audio, and DICOM remain available for clinician review but are not analyzed by this MedGemma adapter.
- Requests use JSON mode and omit tool definitions because MedGemma's Ollama tag does not support tool calls. Model output is validated against CareNavigator's existing Zod schema; malformed output triggers the transparent deterministic fallback.
- Coordinates, names, and other direct identifiers are not added to these model prompts. Local inference is only local when the configured Ollama endpoint is actually on the same trusted machine/network.

## Clinical safety

MedGemma is an experimental developer model, not a medical device. Its output is clinical decision support, not a diagnosis or treatment instruction. Deterministic emergency rules can still override a model recommendation, and clinician review remains required. Do not use the sample fixtures as real patient-care records.

If Ollama or the selected model is unavailable, CareNavigator reports the provider failure and uses its existing deterministic fallback. It does not label fallback text as a MedGemma response.
