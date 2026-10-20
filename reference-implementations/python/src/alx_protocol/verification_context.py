"""Verification-context model kept outside the v1 Block primitive."""

from typing import Literal, NotRequired, TypedDict

GraphValidationStatus = Literal["valid", "invalid", "incomplete", "resource_limit_reached"]


class ExternalParentBoundary(TypedDict):
    hash: str
    reason: Literal["external-boundary", "private-boundary", "unavailable-boundary", "unknown-boundary"]
    declaredBy: Literal["verification-context"]
    requiredForFullValidation: bool


class ResourceLimits(TypedDict, total=False):
    maxBlocks: int
    maxEdges: int


class VerificationContext(TypedDict):
    protocolVersion: Literal["1"]
    validationMode: Literal["closed-world", "open-world"]
    graphRoot: str
    maxDepth: NotRequired[int]
    resourceLimits: NotRequired[ResourceLimits]
    extensions: NotRequired[list[str]]
    externalParents: list[ExternalParentBoundary]


class GraphValidationIssue(TypedDict):
    code: str
    blockHash: str


class GraphLimitReached(TypedDict):
    kind: Literal[
        "maxBlocks",
        "maxEdges",
        "maxBytes",
        "time",
        "memory",
        "cryptographicWork",
        "concurrency",
        "other",
    ]
    name: NotRequired[str]


class GraphVerification(TypedDict):
    protocolVersion: Literal["1"]
    checked: Literal[True]
    status: GraphValidationStatus
    context: VerificationContext
    blocksExamined: int
    edgesExamined: int
    missingParents: list[str]
    externalParents: list[str]
    issues: list[GraphValidationIssue]
    limitReached: NotRequired[GraphLimitReached]
