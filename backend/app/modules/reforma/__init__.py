"""Calendário module: personal monitoring of the Reforma Tributária in official sources."""

from app.modules.reforma.cli import reforma_group as cli_group
from app.modules.reforma.routes import bp as blueprint

__all__ = ["blueprint", "cli_group"]
