"""
Truthful application verification — detects actual submission status.
"""

import os
from enum import Enum, auto
from dataclasses import dataclass
from internship_agent.log.logger import log


class ApplyStatus(Enum):
    """Application submission status codes."""
    APPLIED_SUCCESSFULLY = auto()
    PARTIALLY_COMPLETED = auto()
    LOGIN_REQUIRED = auto()
    APPLICATION_BLOCKED = auto()
    UNSUPPORTED_FLOW = auto()
    FAILED = auto()


@dataclass
class ApplyResult:
    """Result of an application attempt."""
    status: ApplyStatus
    message: str
    screenshot_path: str | None = None
    final_url: str | None = None


SUCCESS_URL_PATTERNS = [
    "/confirmation", "/thank-you", "/success", "/applied", "/complete",
    "/submitted", "/done", "/congratulations"
]

SUCCESS_TEXT_PATTERNS = [
    "thank you", "application received", "successfully submitted",
    "we'll be in touch", "you have applied", "application confirmed",
    "submission received", "application successful"
]

LOGIN_PATTERNS = [
    "sign in", "log in", "login required", "please login",
    "please sign in", "authentication required", "please log in"
]


async def _take_screenshot(page, label: str, screenshots_dir: str = "screenshots") -> str | None:
    """
    Takes a screenshot and saves it with timestamp.

    Args:
        page: Playwright page object
        label: Label for the screenshot (e.g., "after_submit")
        screenshots_dir: Directory to save screenshots

    Returns:
        Path to screenshot file, or None on failure
    """
    os.makedirs(screenshots_dir, exist_ok=True)
    from datetime import datetime
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(screenshots_dir, f"{label}_{ts}.png")
    try:
        await page.screenshot(path=path, full_page=False)
        return path
    except Exception as e:
        log.error(f"Screenshot error: {e}")
        return None


async def verify_submission(page) -> ApplyResult:
    """
    Verifies whether an application was actually submitted by checking:
    1. Final URL for success patterns
    2. Page text for success/login/error patterns
    3. HTTP status code

    Returns:
        ApplyResult with truthful status code
    """
    await page.wait_for_timeout(5000)
    url = page.url.lower()
    text = (await page.inner_text("body")).lower()
    shot = await _take_screenshot(page, "after_submit")

    # Check for login requirement
    if any(p in url for p in ["/login", "/signin"]) or any(p in text for p in LOGIN_PATTERNS):
        return ApplyResult(
            ApplyStatus.LOGIN_REQUIRED,
            "Login required. Cannot verify submission without credentials.",
            shot,
            url
        )

    # Check for success indicators
    if any(p in url for p in SUCCESS_URL_PATTERNS) or any(p in text for p in SUCCESS_TEXT_PATTERNS):
        log.success("✅ Application submission confirmed!")
        return ApplyResult(
            ApplyStatus.APPLIED_SUCCESSFULLY,
            "Application successfully submitted — confirmation page detected.",
            shot,
            url
        )

    # Check for application blocked / error
    blocked_patterns = [
        "application closed", "no longer accepting", "position filled",
        "quota exceeded", "cannot apply", "application blocked",
        "an error occurred", "submission error",
        "something went wrong", "we encountered an error"
    ]
    if any(p in text for p in blocked_patterns):
        return ApplyResult(
            ApplyStatus.APPLICATION_BLOCKED,
            "Application could not be submitted — position blocked or closed.",
            shot,
            url
        )

    # Partial completion — form was filled but no confirmation found
    return ApplyResult(
        ApplyStatus.PARTIALLY_COMPLETED,
        "Form submitted but no confirmation page found. Verify manually.",
        shot,
        url
    )
