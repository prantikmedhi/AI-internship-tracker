"""
LLM client — supports Ollama (local) and Gemini (Google AI) with automatic fallback.
"""
import json
import re
import requests
from internship_agent.log.logger import log
from config import (
    OLLAMA_MODEL, OLLAMA_API_URL, OLLAMA_TIMEOUT_SLOW,
    GEMINI_API_KEY, GEMINI_MODEL, LLM_PROVIDER,
)


def call_ollama(prompt: str, timeout: int = OLLAMA_TIMEOUT_SLOW) -> str:
    """
    Calls Ollama local API with the given prompt.
    Returns the raw content string, or empty string on failure.

    Args:
        prompt: The prompt to send to Ollama
        timeout: Request timeout in seconds

    Returns:
        The model's response content, or empty string if failed
    """
    try:
        response = requests.post(
            OLLAMA_API_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False
            },
            timeout=timeout
        )
        response.raise_for_status()
        content = response.json().get("message", {}).get("content", "")
        return content
    except Exception as e:
        log.error(f"Ollama API error: {e}")
        return ""


def call_gemini(prompt: str, timeout: int = OLLAMA_TIMEOUT_SLOW) -> str:
    """
    Calls Google Gemini API with the given prompt.
    Returns the raw content string, or empty string on failure.

    Args:
        prompt: The prompt to send to Gemini
        timeout: Request timeout in seconds (note: Gemini SDK doesn't support timeout directly)

    Returns:
        The model's response content, or empty string if failed
    """
    if not GEMINI_API_KEY:
        log.warning("call_gemini: GEMINI_API_KEY not set")
        return ""

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        return response.text or ""
    except Exception as e:
        log.error(f"Gemini API error: {e}")
        return ""


def call_llm(prompt: str, timeout: int = OLLAMA_TIMEOUT_SLOW) -> str:
    """
    Calls the configured LLM provider with automatic fallback.

    Provider priority is set by LLM_PROVIDER env var:
    - "ollama" (default): tries Ollama first, falls back to Gemini
    - "gemini": tries Gemini first, falls back to Ollama

    If the primary provider returns empty or fails, automatically tries fallback.

    Args:
        prompt: The prompt to send
        timeout: Request timeout in seconds

    Returns:
        The model's response, or empty string if both providers fail
    """
    if LLM_PROVIDER == "gemini":
        primary, fallback = call_gemini, call_ollama
        primary_name, fallback_name = "Gemini", "Ollama"
    else:
        primary, fallback = call_ollama, call_gemini
        primary_name, fallback_name = "Ollama", "Gemini"

    result = primary(prompt, timeout=timeout)
    if result:
        log.info(f"✓ LLM response from {primary_name} ({len(result)} chars)")
        return result

    log.warning(f"⚠️  {primary_name} returned empty — trying {fallback_name} fallback...")
    result = fallback(prompt, timeout=timeout)
    if result:
        log.info(f"✓ LLM fallback response from {fallback_name} ({len(result)} chars)")
    return result


def extract_json_from_response(content: str) -> dict | None:
    """
    Extracts and parses JSON from LLM response.
    Handles markdown fencing and returns parsed dict, or None on failure.
    """
    if not content:
        return None
    try:
        # Try to extract JSON object from content
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            return json.loads(json_match.group())
    except (json.JSONDecodeError, Exception) as e:
        log.error(f"JSON extraction error: {e}")
    return None
