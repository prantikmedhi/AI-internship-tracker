"""
LLM integration module — Ollama-powered analysis and generation.
"""

from internship_agent.llm.client import call_ollama, call_gemini, call_llm, extract_json_from_response
from internship_agent.llm.resume import analyze_resume, extract_and_write_profile
from internship_agent.llm.ranking import rank_internship, rank_all
from internship_agent.llm.extraction import extract_search_keywords, generate_cover_letter

__all__ = [
    "call_ollama",
    "call_gemini",
    "call_llm",
    "extract_json_from_response",
    "analyze_resume",
    "extract_and_write_profile",
    "rank_internship",
    "rank_all",
    "extract_search_keywords",
    "generate_cover_letter",
]
