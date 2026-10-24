# The draft schema as supplied in chat on 15 Oct 2026, unchanged except imports kept minimal.
# Used only to show which of its gaps are real.
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, conint, field_validator


class DesignStyle(str, Enum):
    MODERN = "Modern"
    MID_CENTURY = "Mid-Century Modern"
    INDUSTRIAL = "Industrial"
    BOHEMIAN = "Bohemian"
    SCANDINAVIAN = "Scandinavian"
    TRADITIONAL = "Traditional"
    MINIMALIST = "Minimalist"
    ECLECTIC = "Eclectic"


class VisualWeight(str, Enum):
    LIGHT = "Light"
    MEDIUM = "Medium"
    HEAVY = "Heavy"


class SilhouetteLine(str, Enum):
    ANGULAR = "Angular/Linear"
    CURVED = "Curved/Organic"
    MIXED = "Mixed"


class MaterialCategory(str, Enum):
    WOOD_WARM = "Warm Wood"
    WOOD_COOL = "Cool Wood"
    WOOD_NEUTRAL = "Neutral Wood"
    METAL_WARM = "Warm Metal (Brass, Gold, Bronze)"
    METAL_COOL = "Cool Metal (Chrome, Stainless, Iron)"
    STONE_GLASS = "Stone or Glass"
    FABRIC = "Fabric Upholstery"
    LEATHER = "Leather"


class PaletteRole(str, Enum):
    DOMINANT_60 = "Dominant (60%)"
    SECONDARY_30 = "Secondary (30%)"
    ACCENT_10 = "Accent (10%)"


class FurnitureItem(BaseModel):
    id: str
    name: str
    style: DesignStyle
    visual_weight: VisualWeight
    silhouette: SilhouetteLine
    primary_material: MaterialCategory
    secondary_material: Optional[MaterialCategory] = None
    color_hex: str
    color_role: PaletteRole

    @field_validator("color_hex")
    @classmethod
    def validate_hex_code(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value.startswith("#") or len(clean_value) != 7:
            raise ValueError("bad hex")
        return clean_value


class StylistWeightConfig(BaseModel):
    style_match_weight: conint(ge=0, le=100) = Field(20)
    scale_balance_weight: conint(ge=0, le=100) = Field(25)
    silhouette_flow_weight: conint(ge=0, le=100) = Field(15)
    material_limit_weight: conint(ge=0, le=100) = Field(20)
    color_ratio_weight: conint(ge=0, le=100) = Field(20)

    @field_validator("*")
    @classmethod
    def validate_total_weights(cls, value: int, info) -> int:
        return value


class FurniturePairingRequest(BaseModel):
    config: StylistWeightConfig = Field(default_factory=StylistWeightConfig)
    items: List[FurnitureItem] = Field(..., min_length=2)
