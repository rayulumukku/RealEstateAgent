/**
 * Mask phone numbers so only the last 4 digits are visible.
 * Example: "+918074697334" -> "*********7334"
 * Example: "8074697334" -> "******7334"
 */
export function maskPhone(phone: string): string {
  if (!phone) return "N/A";
  const cleaned = phone.trim().replace(/\s+/g, "");
  if (cleaned.length <= 4) return cleaned;
  const lastFour = cleaned.slice(-4);
  const maskedLength = cleaned.length - 4;
  return "*".repeat(maskedLength) + lastFour;
}

/**
 * Mask emails so only the last 4 characters of the username are visible, preserving the domain.
 * Example: "john.doe@gmail.com" -> "****.doe@gmail.com"
 * Example: "test@gmail.com" -> "***t@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || email.trim() === "" || email.toLowerCase() === "no email") {
    return "No Email";
  }
  const cleanEmail = email.trim();
  const parts = cleanEmail.split("@");
  if (parts.length !== 2) return cleanEmail;
  const username = parts[0];
  const domain = parts[1];
  if (username.length <= 4) {
    if (username.length <= 1) return "*@" + domain;
    return "*".repeat(username.length - 1) + username.slice(-1) + "@" + domain;
  }
  const lastFour = username.slice(-4);
  const masked = "*".repeat(username.length - 4);
  return `${masked}${lastFour}@${domain}`;
}
