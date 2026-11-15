"""Generate a PKCS#12 keystore for Android release signing.

Usage:
  python scripts/generate-keystore.py [password]

Creates:
  android/app/lx-music-mobile.keystore
  android/keystore.properties

The key is a 2048-bit RSA key valid 25 years (2026-11-15 to 2051-11-15).
DN: C=CN, ST=GD, L=SZ, O=LXMusic, OU=Dev, CN=lx-music-mobile
Key alias: lx-music-mobile

IMPORTANT: Back up the generated keystore file in a safe place. If you
lose it you cannot sign future updates with the same identity.
"""

import sys
import datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    pkcs12,
    BestAvailableEncryption,
)

PASSWORD = sys.argv[1] if len(sys.argv) > 1 else "lxmobile2026"
ALIAS = "lx-music-mobile"
DAYS = 9131  # ~25 years

ROOT = Path(__file__).resolve().parent.parent
ANDROID_APP = ROOT / "android" / "app"
KEYS = ANDROID_APP / f"{ALIAS}.keystore"

now = datetime.datetime.now(datetime.timezone.utc)

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

subject = issuer = x509.Name([
    x509.NameAttribute(x509.NameOID.COUNTRY_NAME, "CN"),
    x509.NameAttribute(x509.NameOID.STATE_OR_PROVINCE_NAME, "GD"),
    x509.NameAttribute(x509.NameOID.LOCALITY_NAME, "SZ"),
    x509.NameAttribute(x509.NameOID.ORGANIZATION_NAME, "LXMusic"),
    x509.NameAttribute(x509.NameOID.ORGANIZATIONAL_UNIT_NAME, "Dev"),
    x509.NameAttribute(x509.NameOID.COMMON_NAME, ALIAS),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + datetime.timedelta(days=DAYS))
    .sign(key, hashes.SHA256())
)

ANDROID_APP.mkdir(parents=True, exist_ok=True)
keystore_bytes = pkcs12.serialize_key_and_certificates(
    ALIAS.encode(),
    key,
    cert,
    [],
    BestAvailableEncryption(PASSWORD.encode()),
)

KEYS.write_bytes(keystore_bytes)

props = ROOT / "android" / "keystore.properties"
props.write_text(
    f"storeFile=app/{ALIAS}.keystore\n"
    f"storePassword={PASSWORD}\n"
    f"keyAlias={ALIAS}\n"
    f"keyPassword={PASSWORD}\n",
    encoding="utf-8",
)

print(f"[OK] keystore: {KEYS}")
print(f"[OK] properties: {props}")
print(f"[OK] alias: {ALIAS}")
print(f"[OK] password: {PASSWORD}")
print(f"[OK] validity: {now.date()} -> {(now + datetime.timedelta(days=DAYS)).date()}")
print("\nReminder: back up the keystore file and the password.")