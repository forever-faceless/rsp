/**
 * The wording of the automatic Instagram replies. Each has a built-in text; the office can
 * replace any of them in the admin. Words in braces are filled in when a reply is sent.
 */
export const TEMPLATE_KEYS = ["interest", "property", "askNumber", "remind", "askWhich", "price", "location", "visit", "sell", "number", "holding", "commentPublic"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_INFO: Record<TemplateKey, { label: string; when: string; fields: string }> = {
  interest: {
    label: "Interested?",
    when: "Sent when someone comments on a reel you have tied to a property, or shares that reel in a message. Two buttons go with it: Details and Price.",
    fields: "{ref} {title}",
  },
  property: {
    label: "Property details",
    when: "Sent when they press Details, or type a property number. It never carries a price.",
    fields: "{ref} {title} {facts} {location} {link} {call} {phone}",
  },
  askNumber: {
    label: "Asked the price",
    when: "Sent when they press Price, or ask the price in their own words.",
    fields: "{call} {phone} {ref}",
  },
  remind: {
    label: "Reminder after the price",
    when: "Sent once, about half an hour after they asked the price, if they have sent nothing since.",
    fields: "{ref} {call} {phone}",
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
  number: { label: "Number received", when: "Sent when they give a mobile number. The number is saved as a lead at the same moment.", fields: "{number} {call} {phone}" },
  holding: {
    label: "Handed to you",
    when: "Sent once when the automation cannot answer and passes the conversation to you, so the person knows a reply is coming.",
    fields: "{call} {phone}",
  },
  commentPublic: { label: "Public reply to a comment", when: "Posted under the comment, while the private message goes to them.", fields: "{username}" },
};

/** The two buttons under "Interested?", and the line that stands in for them when Instagram will not show buttons. */
export const INTEREST_BUTTONS = { details: "Details", price: "Price" } as const;
export const INTEREST_TYPED = "Reply DETAILS or PRICE.";

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  interest: `Interested in {ref}: {title}?
ಇಂಟರೆಸ್ಟ್ ಇದ್ಯಾ? ಡೀಟೇಲ್ಸ್ ಬೇಕಾ, ರೇಟ್ ಬೇಕಾ? ಕೆಳಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ.`,
  askNumber: `Please send us your number and our team will contact you with the price.
ರೇಟ್ ಕಾಲ್‌ನಲ್ಲಿ ಹೇಳ್ತೀವಿ. ನಿಮ್ಮ ನಂಬರ್ ಇಲ್ಲಿ ಹಾಕಿ, ನಮ್ಮ ಟೀಮ್ ಕಾಲ್ ಮಾಡುತ್ತೆ.

Or you can call us on {call}.
ಅಥವಾ {call} ಗೆ ಕಾಲ್ ಮಾಡಿ.`,
  remind: `Still want the price of {ref}? Send your number here and we will call you.
{ref} ರೇಟ್ ಬೇಕಿತ್ತಾ? ನಿಮ್ಮ ನಂಬರ್ ಇಲ್ಲಿ ಹಾಕಿ, ನಾವೇ ಕಾಲ್ ಮಾಡಿ ಹೇಳ್ತೀವಿ.`,
  property: `{ref}: {title}
{facts}
{location}
Photos and map: {link}

For the price and details, call {call}, or send us your number and we will call you.
ರೇಟ್ ಮತ್ತು ಡೀಟೇಲ್ಸ್‌ಗೆ {call} ಗೆ ಕಾಲ್ ಮಾಡಿ, ಅಥವಾ ನಿಮ್ಮ ನಂಬರ್ ಇಲ್ಲಿ ಹಾಕಿ, ನಾವೇ ಕಾಲ್ ಮಾಡ್ತೀವಿ.`,
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
  number: `Thank you. We will call you on {number} shortly. The call will come from {call}.
ಧನ್ಯವಾದ. {number} ಗೆ ಸ್ವಲ್ಪ ಹೊತ್ತಲ್ಲಿ ಕಾಲ್ ಮಾಡ್ತೀವಿ. ಕಾಲ್ {call} ನಂಬರ್‌ನಿಂದ ಬರುತ್ತೆ.`,
  holding: `Got your message. Our team will reply here soon. For a quick answer, send your number and we will call you, or call {call}.
ಮೆಸೇಜ್ ಬಂತು. ನಮ್ಮ ಟೀಮ್ ಇಲ್ಲೇ ರಿಪ್ಲೈ ಮಾಡುತ್ತೆ. ಬೇಗ ಬೇಕಿದ್ರೆ ನಿಮ್ಮ ನಂಬರ್ ಇಲ್ಲಿ ಹಾಕಿ, ನಾವೇ ಕಾಲ್ ಮಾಡ್ತೀವಿ. ಅಥವಾ {call} ಗೆ ಕಾಲ್ ಮಾಡಿ.`,
  commentPublic: `Sent! Check your DM or message requests.`,
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
