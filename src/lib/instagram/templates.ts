/**
 * The wording of the automatic Instagram replies. Each has a built-in text; the office can
 * replace any of them in the admin. Words in braces are filled in when a reply is sent.
 */
export const TEMPLATE_KEYS = ["interest", "property", "askNumber", "askWhich", "price", "location", "visit", "sell", "number", "holding", "commentPublic"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_INFO: Record<TemplateKey, { label: string; when: string; fields: string }> = {
  interest: {
    label: "Interested?",
    when: "Sent when someone comments on a reel you have tied to a property, or shares that reel in a message. Two buttons go with it: Yes and Price.",
    fields: "{ref} {title}",
  },
  property: {
    label: "Property details",
    when: "Sent when they press Yes, or type a property number.",
    fields: "{ref} {title} {facts} {location} {link} {call} {phone}",
  },
  askNumber: {
    label: "Asked the price",
    when: "Sent when they press Price. Instagram also offers them a button that sends their own number.",
    fields: "{call} {phone} {ref}",
  },
  askWhich: {
    label: "Which property?",
    when: "Sent when someone says hello or asks a question and it is not yet known which property they mean.",
    fields: "{example} {listLink} {phone}",
  },
  price: { label: "Price", when: "Not sent by itself. A ready-made reply in the Inbox for when they ask the price.", fields: "{ref} {price} {link} {phone}" },
  location: { label: "Location", when: "Not sent by itself. A ready-made reply in the Inbox for when they ask where the property is.", fields: "{ref} {location} {mapLink} {link}" },
  visit: { label: "Site visit", when: "Not sent by itself. A ready-made reply in the Inbox for when they ask to see the property.", fields: "{ref} {phone}" },
  sell: { label: "Wants to sell", when: "Sent when they say they want to sell a property.", fields: "{sellLink} {phone}" },
  number: { label: "Number received", when: "Sent when they give a mobile number. The number is saved as a lead at the same moment.", fields: "{number} {phone}" },
  holding: {
    label: "Handed to you",
    when: "Sent once when the automation cannot answer and passes the conversation to you, so the person knows a reply is coming.",
    fields: "{phone}",
  },
  commentPublic: { label: "Public reply to a comment", when: "Posted under the comment, while the private message goes to them.", fields: "{username}" },
};

/** The two buttons under "Interested?", and the line that stands in for them when Instagram will not show buttons. */
export const INTEREST_BUTTONS = { yes: "Yes", price: "Price" } as const;
export const INTEREST_TYPED = "Reply YES for the details, or PRICE.";

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  interest: `Interested in {ref}: {title}?`,
  askNumber: `Please share your number, or call us on {call}.`,
  property: `{ref}: {title}
{facts}
{location}
Photos and map: {link}
Share your number, or call {call}.`,
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
  commentPublic: `Sent you a message, please check. ಮೆಸೇಜ್ ಕಳುಹಿಸಿದ್ದೇವೆ, ದಯವಿಟ್ಟು ನೋಡಿ.`,
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
