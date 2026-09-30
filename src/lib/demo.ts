/**
 * Placeholder company details inserted by the seed script. They are obviously fake on
 * purpose, and the "remove demo content" action blanks any of them that are still in place.
 * Real details (phone, WhatsApp, email) are the defaults in the schema and are never touched.
 * The home page figures are not placeholders: they count from the register.
 */
export const DEMO_SETTINGS = {
  workingHoursEn: "Mon to Sat, 10:00 AM to 6:30 PM",
  workingHoursKn: "ಸೋಮವಾರದಿಂದ ಶನಿವಾರ, ಬೆಳಿಗ್ಗೆ 10:00 ರಿಂದ ಸಂಜೆ 6:30",
  establishedYear: 2015,
  heroImage: "",
} as const;

export type DemoSettingKey = keyof typeof DEMO_SETTINGS;

/** What each placeholder falls back to once it is cleared. */
export const DEMO_SETTINGS_RESET: Record<DemoSettingKey, string | number | null> = {
  workingHoursEn: "",
  workingHoursKn: "",
  establishedYear: null,
  heroImage: "",
};
