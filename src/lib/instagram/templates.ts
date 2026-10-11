/**
 * The wording of the automatic Instagram replies. Each has a built-in text; the office can
 * replace any of them in the admin. Words in braces are filled in when a reply is sent.
 */
export const TEMPLATE_KEYS = ["property", "askWhich", "price", "location", "visit", "sell", "number", "holding", "commentPublic"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_INFO: Record<TemplateKey, { label: string; when: string; fields: string }> = {
  property: {
    label: "Property details",
    when: "Sent when someone shares a reel you have tied to a property, types a property number, or comments on that reel.",
    fields: "{ref} {title} {facts} {location} {link} {phone}",
  },
  askWhich: {
    label: "Which property?",
    when: "Sent when someone says hello or asks for details and it is not yet known which property they mean.",
    fields: "{example} {listLink} {phone}",
  },
  price: { label: "Price", when: "Sent when they ask the price of the property being discussed.", fields: "{ref} {price} {link} {phone}" },
  location: { label: "Location", when: "Sent when they ask where the property is.", fields: "{ref} {location} {mapLink} {link}" },
  visit: { label: "Site visit", when: "Sent when they ask to see the property.", fields: "{ref} {phone}" },
  sell: { label: "Wants to sell", when: "Sent when they say they want to sell a property.", fields: "{sellLink} {phone}" },
  number: { label: "Number received", when: "Sent when they give a mobile number. The number is saved as a lead at the same moment.", fields: "{number} {phone}" },
  holding: {
    label: "Handed to you",
    when: "Sent once when the automation cannot answer and passes the conversation to you, so the person knows a reply is coming.",
    fields: "{phone}",
  },
  commentPublic: { label: "Public reply to a comment", when: "Posted under the comment, while the details go by private message.", fields: "{username}" },
};

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  property: `{ref}: {title}
{facts}
{location}

Photos, map and full details:
{link}

Send your mobile number here and we will call you, or call {phone}.
ನಿಮ್ಮ ಮೊಬೈಲ್ ನಂಬರ್ ಕಳುಹಿಸಿ, ನಾವೇ ಕಾಲ್ ಮಾಡುತ್ತೇವೆ.`,
  askWhich: `Namaskara. Which property would you like to know about? Send its number (for example {example}) or share the reel here.
ಯಾವ ಪ್ರಾಪರ್ಟಿ ಬಗ್ಗೆ ತಿಳಿಯಬೇಕು? ಅದರ ನಂಬರ್ ಅಥವಾ ರೀಲ್ ಇಲ್ಲಿ ಕಳುಹಿಸಿ.

All our properties:
{listLink}`,
  price: `{ref}: {price}
For the full price breakup, send your mobile number and we will call you, or call {phone}.
{link}`,
  location: `{ref} is at {location}.
Map and directions:
{mapLink}`,
  visit: `We can arrange a visit to {ref}. Send your mobile number and a time that suits you, and we will call to fix it. Or call {phone}.
ಸೈಟ್ ವಿಸಿಟ್‌ಗೆ ನಿಮ್ಮ ಮೊಬೈಲ್ ನಂಬರ್ ಕಳುಹಿಸಿ, ನಾವು ಕಾಲ್ ಮಾಡುತ್ತೇವೆ.`,
  sell: `We can list your property and bring you buyers. Tell us about it here:
{sellLink}
Or send your mobile number and we will call you.`,
  number: `Thank you. We will call you on {number} shortly.
ಧನ್ಯವಾದಗಳು. ನಾವು ಶೀಘ್ರದಲ್ಲೇ ಕಾಲ್ ಮಾಡುತ್ತೇವೆ.`,
  holding: `Thank you for your message. Our team will reply here shortly. For a quick answer, call {phone}.
ನಿಮ್ಮ ಮೆಸೇಜ್‌ಗೆ ಧನ್ಯವಾದಗಳು. ನಮ್ಮ ತಂಡ ಶೀಘ್ರದಲ್ಲೇ ಉತ್ತರಿಸುತ್ತದೆ.`,
  commentPublic: `Sent you the details by message. ವಿವರಗಳನ್ನು ಮೆಸೇಜ್‌ನಲ್ಲಿ ಕಳುಹಿಸಿದ್ದೇವೆ.`,
};

/** The office's wording when it has written one, the built-in text otherwise. */
export function templateText(saved: Record<string, string> | null | undefined, key: TemplateKey): string {
  const own = saved?.[key];
  return own?.trim() ? own.trim() : DEFAULT_TEMPLATES[key];
}

/** Fills the braces, then drops lines left empty and tidies doubled blank lines. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole))
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
