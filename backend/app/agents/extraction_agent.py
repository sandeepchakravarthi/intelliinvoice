import json
import re

import httpx

from app.core.config import get_config
from app.core.logging import get_logger
from app.schemas.invoice import ExtractedInvoiceData


logger = get_logger(__name__)


SYSTEM_PROMPT = """You are a professional invoice data extraction expert.
Extract structured information from invoice text and respond with valid JSON only.
No explanations, no markdown, no code blocks. Only the JSON object.

Required JSON structure:
{
  "vendor_name": "string or null",
  "vendor_gstin": "string or null (15-char GST number like 29ABCDE1234F1Z5)",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "total_amount": number or null,
  "tax_amount": number or null,
  "subtotal_amount": number or null,
  "currency": "INR",
  "description": "string or null",
  "line_items": [{"description": string, "quantity": number, "unit_price": number, "amount": number}] or []
}

Rules:
- All amounts must be numeric values, never strings
- All dates must be YYYY-MM-DD format
- If a field is not present in the text, use null
- Currency is INR unless explicitly stated otherwise
"""


class ExtractionAgent:
    """
    Agent 2: Extraction Agent

    Sends raw OCR text to Qwen 2.5 running locally via Ollama.
    Parses the structured JSON response and validates it using Pydantic.
    """

    def __init__(self) -> None:
        self._cfg = get_config()["llm"]
        self._client: httpx.AsyncClient = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._cfg["timeout_seconds"])
        return self._client

    def _clean_json(self, raw: str) -> str:
        cleaned = raw.strip()
        cleaned = re.sub(r"```json\s*", "", cleaned)
        cleaned = re.sub(r"```\s*", "", cleaned)
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            return cleaned[start:end]
        return cleaned

    async def process(self, raw_text: str) -> dict:
        logger.info(f"Extraction Agent processing {len(raw_text)} chars of OCR text")

        user_prompt = (
            "Extract all invoice information from the following OCR text and return "
            "only the JSON object:\n\n"
            f"--- BEGIN INVOICE TEXT ---\n{raw_text[:4000]}\n--- END INVOICE TEXT ---"
        )

        payload = {
            "model": self._cfg["model"],
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": self._cfg["temperature"],
                "num_predict": self._cfg["max_tokens"],
            },
        }

        try:
            client = self._get_client()
            response = await client.post(
                f"{self._cfg['base_url']}/api/chat",
                json=payload,
            )
            response.raise_for_status()

            raw_content = response.json()["message"]["content"]
            logger.debug(f"LLM raw response: {raw_content[:300]}")

            parsed = json.loads(self._clean_json(raw_content))
            validated = ExtractedInvoiceData(**parsed)

            logger.info(
                f"Extraction complete: vendor={validated.vendor_name} "
                f"number={validated.invoice_number} amount={validated.total_amount}"
            )
            return validated.model_dump()

        except httpx.ConnectError:
            logger.error("Cannot connect to Ollama. Ensure ollama serve is running.")
            raise RuntimeError("LLM service unavailable. Start Ollama and pull qwen2.5:7b")
        except json.JSONDecodeError as exc:
            logger.error(f"LLM returned invalid JSON: {exc}")
            raise RuntimeError(f"LLM returned malformed JSON: {exc}")
        except Exception as exc:
            logger.error(f"Extraction failed: {exc}", exc_info=True)
            raise RuntimeError(f"Extraction agent error: {exc}")

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
