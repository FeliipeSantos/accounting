"""Collectors of the official sources, by source id (must match catalog.SOURCES).

Each collector is a function collect(ctx) -> list[dict] of raw items with
externalId, title, url, publishedAt, publishedTime (optional), excerpt, actType, organ.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote


@dataclass
class CollectContext:
    """What a collector receives: HTTP functions, the period and known items."""

    fetch_text: Callable[..., str]
    fetch_json: Callable[..., Any]
    today: str
    since: str
    is_known: Callable[[str], bool]


def encode_uri_component(value) -> str:
    """Same result as JavaScript's encodeURIComponent."""
    return quote(str(value), safe="-_.!~*'()")


def registry() -> dict[str, Callable[[CollectContext], list[dict]]]:
    from app.modules.intelligence.collectors import camara, confaz, dou, esocial, govbr_news, legislacao, simples, sped

    return {
        "dou": dou.collect,
        "receita": govbr_news.receita,
        "fazenda": govbr_news.fazenda,
        "simples": simples.collect,
        "confaz": confaz.collect,
        "sped": sped.collect,
        "esocial": esocial.collect,
        "legislacao": legislacao.collect,
        "camara": camara.collect,
    }
