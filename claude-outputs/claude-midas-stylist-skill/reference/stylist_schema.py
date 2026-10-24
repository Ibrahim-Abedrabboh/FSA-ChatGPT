"""Midas Stylist input schema (Pydantic v2). Draft, 15 Oct 2026.

Changes from the draft schema supplied on 15 Oct 2026:
- Unknown is allowed everywhere (None) and never replaced by a guess.
- Every filled descriptive attribute must say where it came from (basis).
- Hero, Midas supporting piece and generic context are separate roles.
  A Midas piece needs SKU + catalogue photo + date read. Generic context cannot carry a SKU.
- Hex check is a real check (6 hex digits). Colour from a photo is marked as an estimate.
- Weights are normalised; they no longer need to sum to 100, but at least one must be above 0.
- Eight pillars instead of five: texture, function and focal point were missing,
  and "material texture affinity" mixed two rules with opposite intent.
- The style list is one list, held in STYLE_MENU, so it can be changed in one place.
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# ------------------------------------------------------------------
# Menus. Proposed canonical source: Magnific board "Midas · 29 September
# casework · Working copy", node "06 CREATIVE CONTROLS · Midas V3".
# Owner decision pending: a second, different list exists on the same board.
# ------------------------------------------------------------------
STYLE_MENU = (
    "Contemporary Elegance", "Warm Minimalism", "Modern Luxury", "Modern Classic",
    "Japandi", "Scandinavian", "Mid-Century Modern", "Mediterranean",
    "Contemporary Arabesque", "Eclectic Curated",
)
AMBIENCE_MENU = (
    "Calm / Restorative", "Warm / Welcoming", "Elegant / Formal",
    "Airy / Fresh", "Intimate / Cozy", "Expressive / Vibrant",
)
PRESET_MENU = (
    "Daylight overview", "Editorial hero", "Golden-hour atmosphere", "Evening comfort",
)

Basis = Literal["vendor_stated", "catalogue_stated", "observed_in_photo", "estimated_from_photo"]
Weight = Annotated[int, Field(ge=0, le=100)]


class Role(str, Enum):
    HERO = "hero"                    # the vendor product; locked
    MIDAS_SUPPORT = "midas_support"  # a real Midas SKU with catalogue photo
    GENERIC = "generic_context"      # rug, books, plant... never called Midas


class VisualWeight(str, Enum):
    LIGHT = "light"    # leggy, glass, open frame
    MEDIUM = "medium"
    HEAVY = "heavy"    # skirted, plinth, solid block


class Silhouette(str, Enum):
    ANGULAR = "angular"
    CURVED = "curved"
    MIXED = "mixed"


class FinishFamily(str, Enum):
    WOOD = "wood"
    METAL = "metal"
    STONE = "stone"
    GLASS = "glass"
    FABRIC = "fabric"
    LEATHER = "leather"
    OTHER = "other"


class Undertone(str, Enum):
    WARM = "warm"
    COOL = "cool"
    NEUTRAL = "neutral"


class Texture(str, Enum):
    SMOOTH = "smooth"   # lacquer, glass, polished metal, leather
    MEDIUM = "medium"
    ROUGH = "rough"     # boucle, linen, open-grain wood


class PaletteRole(str, Enum):
    DOMINANT = "dominant_60"
    SECONDARY = "secondary_30"
    ACCENT = "accent_10"


class Availability(str, Enum):
    IN_STOCK = "in_stock"
    PRE_ORDER = "pre_order"
    OUT_OF_STOCK = "out_of_stock"
    NOT_CONFIRMED = "not_confirmed"


class Finish(BaseModel):
    family: FinishFamily
    name: str = Field(..., min_length=1, description="e.g. walnut, brushed brass, linen")
    undertone: Optional[Undertone] = None


class DimensionsCm(BaseModel):
    width: Optional[float] = Field(None, gt=0)
    depth: Optional[float] = Field(None, gt=0)
    height: Optional[float] = Field(None, gt=0)


DESCRIPTIVE_FIELDS = ("style", "visual_weight", "silhouette", "finishes", "texture",
                      "colour_hex", "dimensions_cm")


class Piece(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    role: Role
    category: str = Field(..., min_length=1, description="taxonomy profile, e.g. sofa, centre-table")
    sku: Optional[str] = None
    catalogue_photo: Optional[str] = Field(None, description="URL or file hash of the catalogue photo")
    retrieved_on: Optional[date] = None
    availability: Availability = Availability.NOT_CONFIRMED

    # Descriptive tags. None means not confirmed.
    style: Optional[str] = None
    visual_weight: Optional[VisualWeight] = None
    silhouette: Optional[Silhouette] = None
    finishes: list[Finish] = Field(default_factory=list)
    texture: Optional[Texture] = None
    colour_hex: Optional[str] = None
    dimensions_cm: Optional[DimensionsCm] = None
    basis: dict[str, Basis] = Field(default_factory=dict,
                                    description="Where each filled descriptive field came from")

    # Plan decisions for non-hero pieces (choices, not facts, so no basis needed).
    purpose: Optional[str] = Field(None, description="why it is there, e.g. 'surface for the lamp'")
    rests_on: Optional[str] = Field(None, description="floor, centre table, wall...")

    @field_validator("colour_hex")
    @classmethod
    def _hex(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if len(v) != 7 or v[0] != "#" or any(c not in "0123456789abcdefABCDEF" for c in v[1:]):
            raise ValueError("colour_hex must be '#' followed by 6 hex digits, e.g. #8B5E3C")
        return v.upper()

    @field_validator("style")
    @classmethod
    def _style(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in STYLE_MENU:
            raise ValueError(f"style must be one of STYLE_MENU, got {v!r}")
        return v

    @model_validator(mode="after")
    def _provenance(self) -> "Piece":
        if self.role is Role.MIDAS_SUPPORT:
            missing = [f for f in ("sku", "catalogue_photo", "retrieved_on") if not getattr(self, f)]
            if missing:
                raise ValueError(f"{self.id}: a Midas supporting piece needs {', '.join(missing)}; "
                                 "without them it can only be generic context")
        if self.role is Role.GENERIC and self.sku:
            raise ValueError(f"{self.id}: generic context cannot carry a SKU (it would read as a Midas product)")
        for f in DESCRIPTIVE_FIELDS:
            val = getattr(self, f)
            filled = bool(val) if isinstance(val, list) else val is not None
            if filled and f not in self.basis:
                raise ValueError(f"{self.id}: '{f}' is filled but has no basis; "
                                 "leave it empty (not confirmed) or say where it came from")
        if self.colour_hex and self.basis.get("colour_hex") == "observed_in_photo":
            raise ValueError(f"{self.id}: a hex read from a photo is an estimate; use basis 'estimated_from_photo'")
        return self


class Surface(BaseModel):
    """Room surfaces that carry the 60-30-10 split: walls, floor, rug, curtains."""
    name: str
    colour: str = Field(..., description="colour family in words, e.g. warm ivory")
    role: PaletteRole
    area_share: Optional[float] = Field(None, ge=0, le=1, description="estimated share of visible area")


class Weights(BaseModel):
    """Relative importance per pillar. Normalised before use; sum need not be 100."""
    scale_proportion: Weight = 20
    silhouette_lines: Weight = 15
    materials_finishes: Weight = 15
    colour_distribution: Weight = 15
    texture_contrast: Weight = 10
    function_practicality: Weight = 10
    focal_point: Weight = 10
    style_cohesion: Weight = 5

    @model_validator(mode="after")
    def _not_all_zero(self) -> "Weights":
        if sum(self.model_dump().values()) == 0:
            raise ValueError("at least one weight must be above 0")
        return self

    def normalised(self) -> dict[str, float]:
        d = self.model_dump()
        total = sum(d.values())
        return {k: v / total for k, v in d.items()}


PROFILES: dict[str, Weights] = {
    # Default. Product-photo work puts scale and function first.
    "balanced": Weights(),
    # Same era and finishes; penalises eclectic mixes.
    "strict_match": Weights(style_cohesion=30, materials_finishes=25, silhouette_lines=10,
                            scale_proportion=15, colour_distribution=10, texture_contrast=5,
                            function_practicality=3, focal_point=2),
    # Era may differ; shape, scale and contrast carry the room.
    "eclectic_designer": Weights(style_cohesion=3, scale_proportion=25, silhouette_lines=25,
                                 texture_contrast=17, colour_distribution=10, materials_finishes=10,
                                 function_practicality=5, focal_point=5),
}


class StylingRequest(BaseModel):
    pieces: list[Piece] = Field(..., min_length=2)
    surfaces: list[Surface] = Field(default_factory=list)
    style: Optional[str] = None
    ambience: Optional[str] = None
    preset: Optional[str] = None
    output: Literal["white_background", "lifestyle", "website_package"] = "lifestyle"
    profile: str = "balanced"
    weights: Optional[Weights] = None
    max_midas_pieces: int = Field(3, ge=0, le=6)

    @model_validator(mode="after")
    def _checks(self) -> "StylingRequest":
        heroes = [p for p in self.pieces if p.role is Role.HERO]
        if len(heroes) != 1:
            raise ValueError(f"exactly one hero piece is required, found {len(heroes)}")
        ids = [p.id for p in self.pieces]
        if len(ids) != len(set(ids)):
            raise ValueError("piece ids must be unique (a piece shown twice in a photo is one piece)")
        for field, menu in (("style", STYLE_MENU), ("ambience", AMBIENCE_MENU), ("preset", PRESET_MENU)):
            v = getattr(self, field)
            if v is not None and v not in menu:
                raise ValueError(f"{field} {v!r} is not on the menu")
        if self.weights is None and self.profile not in PROFILES:
            raise ValueError(f"unknown profile {self.profile!r}")
        return self

    @property
    def hero(self) -> Piece:
        return next(p for p in self.pieces if p.role is Role.HERO)

    def active_weights(self) -> Weights:
        return self.weights or PROFILES[self.profile]
