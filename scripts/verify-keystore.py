from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12

data = open(r'C:\Users\Administrator\Downloads\lx-music-mobile-master\android\app\lx-music-mobile.keystore', 'rb').read()
key, cert, _ = pkcs12.load_key_and_certificates(data, b'lxmobile2026')
print('Subject:', cert.subject)
print('Valid from:', cert.not_valid_before)
print('Valid to:', cert.not_valid_after)
print('Key type:', type(key).__name__)
print('Key size:', key.key_size)