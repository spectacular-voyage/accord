export class TextDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TextDecodeError";
  }
}

export function normalizeLineEndings(value: string): string {
  return value.replaceAll("\r\n", "\n");
}

export function decodeUtf8Text(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TextDecodeError(`Invalid UTF-8 text input: ${message}`);
  }
}

export function compareTextContents(
  left: Uint8Array,
  right: Uint8Array,
): boolean {
  const leftText = normalizeLineEndings(decodeUtf8Text(left));
  const rightText = normalizeLineEndings(decodeUtf8Text(right));
  return leftText === rightText;
}
