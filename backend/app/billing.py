"""StoreKit 2 signed transaction verification (no Apple API key needed).

A StoreKit 2 transaction is a JWS signed by Apple. We check that its x5c certificate chain ends in
Apple's root CA (downloaded once into APPLE_ROOT_CERT_DIR), verify the signature with the leaf key,
and check bundle id / app id. Server-to-server App Store Server Notifications v2 use the same format.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import jwt
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ec

from .config import get_settings


class BillingError(Exception):
    pass


@dataclass
class Transaction:
    original_transaction_id: str
    product_id: str
    expires_at: datetime | None
    environment: str


def _load_roots() -> list[x509.Certificate]:
    d = get_settings().apple_root_cert_dir
    if not d or not Path(d).is_dir():
        raise BillingError("APPLE_ROOT_CERT_DIR is not set")
    roots = []
    for f in Path(d).glob("*.cer"):
        data = f.read_bytes()
        roots.append(x509.load_der_x509_certificate(data) if not data.startswith(b"-----") else x509.load_pem_x509_certificate(data))
    if not roots:
        raise BillingError("no Apple root certificates found")
    return roots


def _verify_issued_by(child: x509.Certificate, parent: x509.Certificate) -> None:
    pub = parent.public_key()
    if not isinstance(pub, ec.EllipticCurvePublicKey):
        raise BillingError("unexpected key type in chain")
    pub.verify(child.signature, child.tbs_certificate_bytes, ec.ECDSA(child.signature_hash_algorithm))  # type: ignore[arg-type]
    now = datetime.now(timezone.utc)
    if not (child.not_valid_before_utc <= now <= child.not_valid_after_utc):
        raise BillingError("certificate expired")


def verify_apple_jws(jws: str) -> dict:
    """Verify any App Store JWS (transactions and server notifications) and return its claims."""
    import base64

    try:
        header = jwt.get_unverified_header(jws)
        chain = [x509.load_der_x509_certificate(base64.b64decode(c)) for c in header["x5c"]]
    except Exception as e:  # malformed input
        raise BillingError("malformed transaction") from e
    if len(chain) != 3:
        raise BillingError("unexpected certificate chain")
    leaf, intermediate, root = chain
    if not any(root.fingerprint(root.signature_hash_algorithm) == r.fingerprint(r.signature_hash_algorithm) for r in _load_roots()):  # type: ignore[arg-type]
        raise BillingError("chain does not end in Apple root")
    try:
        _verify_issued_by(leaf, intermediate)
        _verify_issued_by(intermediate, root)
        claims = jwt.decode(jws, leaf.public_key(), algorithms=["ES256"], options={"verify_aud": False})  # type: ignore[arg-type]
    except BillingError:
        raise
    except Exception as e:
        raise BillingError("signature invalid") from e
    return claims


def verify_signed_transaction(jws: str) -> Transaction:
    s = get_settings()
    claims = verify_apple_jws(jws)
    if claims.get("bundleId") != s.apple_bundle_id:
        raise BillingError("bundle id mismatch")
    if s.apple_app_id is not None and claims.get("environment") == "Production" and claims.get("appAppleId") != s.apple_app_id:
        raise BillingError("app id mismatch")
    exp = claims.get("expiresDate")
    return Transaction(
        original_transaction_id=str(claims["originalTransactionId"]),
        product_id=claims["productId"],
        expires_at=datetime.fromtimestamp(exp / 1000, tz=timezone.utc) if exp else None,
        environment=claims.get("environment", "Sandbox"),
    )
