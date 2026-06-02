"""Verification-context model kept outside the v1 Block primitive."""

from typing import Literal, TypedDict


class ExternalParentBoundary(TypedDict):
    hash: str
    reason: Literal["external-boundary"]
    declaredBy: Literal["verification-context"]
    requiredForFullValidation: bool


class VerificationContext(TypedDict):
    protocolVersion: Literal["1"]
    validationMode: Literal["closed-world", "open-world"]
    graphRoot: str
    extensions: list[str]
    externalParents: list[ExternalParentBoundary]
