"""
NLP endpoints using Ollama (Qwen 2.5-32B / Phi-4) for text classification
and named entity extraction.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.ollama_client import OllamaClient

router = APIRouter()


# ── Classification ─────────────────────────────────────────────
class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Text to classify")
    categories: list[str] = Field(..., min_length=2, description="Possible categories")
    model: str = Field(default="qwen2.5:32b", description="Ollama model name")


class ClassifyResponse(BaseModel):
    category: str
    confidence: float = Field(ge=0, le=1)
    summary: str


@router.post("/classify", response_model=ClassifyResponse)
async def classify_text(req: ClassifyRequest):
    """
    Classify text into one of the provided categories using an LLM.

    Uses Ollama to run the model locally (Qwen 2.5-32B by default).
    """
    try:
        client = OllamaClient()
        result = await client.classify(
            text=req.text,
            categories=req.categories,
            model=req.model,
        )
        return ClassifyResponse(**result)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


# ── Entity Extraction ─────────────────────────────────────────
class ExtractRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Text to extract entities from")
    fields: list[str] = Field(..., min_length=1, description="Field names to extract (e.g. 'species', 'location', 'date')")
    model: str = Field(default="qwen2.5:32b", description="Ollama model name")


class EntityResult(BaseModel):
    field: str
    value: str
    confidence: float = Field(ge=0, le=1)


class ExtractResponse(BaseModel):
    entities: list[EntityResult]


@router.post("/extract", response_model=ExtractResponse)
async def extract_entities(req: ExtractRequest):
    """
    Extract named entities from text using an LLM.

    Provide the field names you want extracted (e.g. species, location, date)
    and the model will attempt to find them in the text.
    """
    try:
        client = OllamaClient()
        result = await client.extract(
            text=req.text,
            fields=req.fields,
            model=req.model,
        )
        return ExtractResponse(entities=result)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
