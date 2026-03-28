"""
Structured terminal logger with custom format and SUCCESS level.
"""

import logging
from typing import Optional


# Custom log level
SUCCESS = 25
logging.addLevelName(SUCCESS, "SUCCESS")


class StructuredFormatter(logging.Formatter):
    """Custom formatter: [HH:MM:SS] LEVEL  message"""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, "%H:%M:%S")
        level = record.levelname
        message = record.getMessage()
        return f"[{timestamp}] {level:8s} {message}"


def create_logger() -> logging.Logger:
    """Create and configure the structured logger."""
    logger = logging.getLogger("internship_agent")
    logger.setLevel(logging.DEBUG)

    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()

    # Console handler
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(StructuredFormatter())
    logger.addHandler(handler)

    return logger


# Singleton instance
log = create_logger()


# Convenience methods on the logger
def add_success_method(logger_obj):
    """Add success() method to logger."""
    def success(msg: str, *args, **kwargs):
        logger_obj.log(SUCCESS, msg, *args, **kwargs)
    logger_obj.success = success


def add_step_method(logger_obj):
    """Add step(n, total, msg) method to logger."""
    def step(n: int, total: int, msg: str):
        logger_obj.log(logging.DEBUG, f"[{n}/{total}] {msg}")
    logger_obj.step = step


# Add convenience methods
add_success_method(log)
add_step_method(log)
