const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

function xorWithKey(bytes, key) {
  const keyBytes = encoder.encode(key);
  return bytes.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);
}

export function encrypt(text, key) {
  const bytes = xorWithKey(encoder.encode(text), key);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decrypt(encryptedText, key) {
  const bytes = Uint8Array.from(atob(encryptedText), (char) => char.charCodeAt(0));
  return decoder.decode(xorWithKey(bytes, key));
}
