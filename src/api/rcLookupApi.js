// Never manufacture vehicle details when no verified lookup provider is connected.
export function isPlausibleRegistrationNumber(value) {
  const cleaned = (value || "").replace(/\s|-/g, "").toUpperCase();
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(cleaned);
}

export async function lookupByRegistrationNumber(regNumber) {
  const cleaned = (regNumber || "").replace(/\s|-/g, "").toUpperCase();
  if (!isPlausibleRegistrationNumber(cleaned)) {
    throw new Error("Enter a valid registration number, e.g. DL4CAB1234");
  }

  throw new Error("Automatic registration lookup is unavailable. Please enter your car details manually from your RC document.");
}
