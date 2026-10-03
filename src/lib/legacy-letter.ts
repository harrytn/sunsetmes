/** Compatibility decoder used only to permanently restore letters sent by the old app. */
import { createDecipheriv } from 'node:crypto';

export type RestoredLetter = {
  content: string;
  addressFrom: string | null;
  addressTo: string | null;
  pigeonDestination: string | null;
};

export function decodeLegacyLetter(encryptedContent: string, iv: string, aesKey: string): RestoredLetter {
  const key = Buffer.from(aesKey, 'base64');
  const nonce = Buffer.from(iv, 'base64');
  const ciphertext = Buffer.from(encryptedContent, 'base64');
  if (key.length !== 32 || nonce.length !== 12 || ciphertext.length < 16) {
    throw new Error('Invalid legacy letter data.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(ciphertext.subarray(-16));
  const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]).toString('utf8');
  const optionalText = (value: unknown) => typeof value === 'string' && value.length ? value : null;
  // The first release encrypted raw text; later releases encrypted a JSON envelope.
  try {
    const data: unknown = JSON.parse(plaintext);
    if (typeof data === 'object' && data !== null && 'content' in data && typeof data.content === 'string') {
      const payload = data as Record<string, unknown>;
      return {
        content: data.content,
        addressFrom: optionalText(payload.addressFrom),
        addressTo: optionalText(payload.addressTo),
        pigeonDestination: optionalText(payload.pigeonDestination),
      };
    }
  } catch { /* Raw letter text is preserved exactly, including whitespace. */ }
  return { content: plaintext, addressFrom: null, addressTo: null, pigeonDestination: null };
}
