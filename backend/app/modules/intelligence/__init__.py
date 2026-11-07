"""Inteligência Contábil module."""

from app.modules.intelligence.cli import intel_group as cli_group
from app.modules.intelligence.routes import bp as blueprint

__all__ = ["blueprint", "cli_group"]
