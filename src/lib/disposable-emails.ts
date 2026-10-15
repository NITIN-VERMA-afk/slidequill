/**
 * src/lib/disposable-emails.ts
 *
 * Normalizes email addresses (strips Gmail dots and plus-addressing aliases)
 * and blocks disposable/temporary email provider domains to prevent free-tier farming.
 */

export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "throwawaymail.com",
  "sharklasers.com",
  "getairmail.com",
  "dispostable.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "trashmail.me",
  "fakemailgenerator.com",
  "mohmal.com",
  "inboxkitten.com",
  "generator.email",
  "burnermail.io",
  "emailondeck.com",
  "crazymailing.com",
  "dropmail.me",
  "nada.ltd",
  "getnada.com",
  "mytemp.email",
  "harakirimail.com",
  "maildrop.cc",
  "tempinbox.com",
  "disposablemail.com",
  "trash-mail.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "einrot.com",
]);

/**
 * Normalizes email:
 * - Trims and lowercases.
 * - For Gmail/Googlemail: strips all dots in local part and plus aliases (e.g. john.doe+1@gmail.com -> johndoe@gmail.com).
 * - For other providers: strips plus aliases (e.g. user+news@example.com -> user@example.com).
 * - Canonicalizes googlemail.com to gmail.com.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return (email || "").trim().toLowerCase();
  }

  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  let domain = rawDomain.trim();
  let local = rawLocal.trim().split("+")[0]; // Remove plus alias

  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  if (domain === "gmail.com") {
    // Gmail ignores all periods in the username
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

/**
 * Checks whether an email address belongs to a known disposable/temporary domain.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return false;
  }

  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;

  return DISPOSABLE_DOMAINS.has(domain);
}
