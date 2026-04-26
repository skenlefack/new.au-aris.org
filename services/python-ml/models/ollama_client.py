"""
Ollama HTTP client for NLP tasks.

Connects to the Ollama instance running natively on the VM-AI (systemd).
Provides classification and entity extraction via LLM prompts.
"""

import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DEFAULT_MODEL = "qwen2.5:32b"
REQUEST_TIMEOUT = 120.0  # LLM generation can be slow


class OllamaClient:
    """HTTP client for Ollama API."""

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or OLLAMA_URL

    async def is_available(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def _generate(self, model: str, prompt: str, system: str = "") -> str:
        """Send a generation request to Ollama and return the response text."""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 1024,
            },
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            try:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("response", "")
            except httpx.ConnectError:
                raise ConnectionError(f"Cannot connect to Ollama at {self.base_url}")
            except httpx.HTTPStatusError as e:
                logger.error("Ollama HTTP error: %s", e)
                raise

    async def classify(
        self,
        text: str,
        categories: list[str],
        model: str = DEFAULT_MODEL,
    ) -> dict:
        """
        Classify text into one of the given categories.

        Returns dict with "category", "confidence", "summary".
        """
        categories_str = ", ".join(categories)
        system_prompt = (
            "You are a classification assistant for the African Union's Animal Resources "
            "Information System (ARIS). You classify text into predefined categories. "
            "Always respond with valid JSON only, no extra text."
        )
        prompt = (
            f"Classify the following text into exactly ONE of these categories: [{categories_str}]\n\n"
            f"Text: {text}\n\n"
            f'Respond with JSON: {{"category": "<chosen_category>", "confidence": <0.0-1.0>, '
            f'"summary": "<one-sentence summary>"}}'
        )

        raw = await self._generate(model=model, prompt=prompt, system=system_prompt)

        try:
            # Try to parse JSON from the response (may contain markdown fences)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(cleaned)
            return {
                "category": str(result.get("category", categories[0])),
                "confidence": float(result.get("confidence", 0.5)),
                "summary": str(result.get("summary", "")),
            }
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse Ollama classification response: %s", e)
            return {
                "category": categories[0],
                "confidence": 0.0,
                "summary": f"Parse error — raw response: {raw[:200]}",
            }

    async def extract(
        self,
        text: str,
        fields: list[str],
        model: str = DEFAULT_MODEL,
    ) -> list[dict]:
        """
        Extract named entities for the requested fields.

        Returns list of { "field", "value", "confidence" } dicts.
        """
        fields_str = ", ".join(fields)
        system_prompt = (
            "You are a named-entity extraction assistant for the African Union's Animal "
            "Resources Information System (ARIS). Extract structured data from unstructured text. "
            "Always respond with valid JSON only, no extra text."
        )
        prompt = (
            f"Extract the following fields from the text: [{fields_str}]\n\n"
            f"Text: {text}\n\n"
            f'Respond with JSON: {{"entities": [{{"field": "<field_name>", "value": "<extracted_value>", '
            f'"confidence": <0.0-1.0>}}]}}'
        )

        raw = await self._generate(model=model, prompt=prompt, system=system_prompt)

        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(cleaned)
            entities = result.get("entities", [])
            return [
                {
                    "field": str(e.get("field", "")),
                    "value": str(e.get("value", "")),
                    "confidence": float(e.get("confidence", 0.5)),
                }
                for e in entities
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Failed to parse Ollama extraction response: %s", e)
            return [
                {"field": f, "value": "", "confidence": 0.0}
                for f in fields
            ]
