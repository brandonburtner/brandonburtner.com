"""Generate a VAPID (application server) EC P-256 key pair for Web Push.

Outputs:
  - vapid_private.pem : PKCS8 private key -> goes to the notifier Lambda env
  - prints VAPID_PUBLIC_KEY (base64url of the uncompressed public point) -> frontend applicationServerKey
"""
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

priv = ec.generate_private_key(ec.SECP256R1())

# Private key as PKCS8 PEM (pywebpush/py_vapid can load this)
pem = priv.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
)

# Public key as the raw uncompressed point (0x04 || X || Y), base64url — this is the
# applicationServerKey the browser expects.
pub_point = priv.public_key().public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint,
)
public_b64 = b64url(pub_point)

with open("vapid_private.pem", "wb") as f:
    f.write(pem)

print("VAPID_PUBLIC_KEY=" + public_b64)
print("---PEM-START---")
print(pem.decode("ascii").strip())
print("---PEM-END---")
