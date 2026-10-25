import { InputError } from "./http.ts";
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

export function randomCharacters(length: number, alphabet: string): string {
  if (
    !Number.isSafeInteger(length) || length < 1 || length > 128 ||
    alphabet.length < 2 || alphabet.length > 256
  ) throw new Error("Invalid random string parameters.");
  const ceiling = 256 - (256 % alphabet.length);
  let output = "";
  while (output.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < ceiling) output += alphabet[byte % alphabet.length];
      if (output.length === length) break;
    }
  }
  return output;
}

export const randomPassword = (length = 16) =>
  randomCharacters(length, ALPHABET);
export const randomDigits = (length: number) =>
  randomCharacters(length, "0123456789");

export function accountPassword(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return randomPassword();
  }
  if (
    typeof value !== "string" || value.length < 8 || value.length > 128 ||
    !value.trim()
  ) throw new InputError("Password must be 8–128 characters.");
  return value; // Never silently alter a caller's password.
}
