// Every editable section and text of the public course landing page, stored as one JSON object
// (CourseLandingContent.content). Texts that differ by phase have a `prelaunch` and a `live`
// version: the prelaunch one is shown while the prelaunch offer is running, the live one otherwise.
//
// Texts may contain placeholders the page fills in: {price}, {originalPrice}, {discount},
// {launchDate}, {offerEndDate}, {courseTitle}. Wrap words in *asterisks* to highlight them in titles.

const SHORT = 160;
const TITLE = 200;
const TEXT = 600;
const LONG = 1500;

// Field types: { type: "text", max } | { type: "phase", max } | { type: "bool" }
// | { type: "object", fields } | { type: "list", max, of } (of = a field type)
const text = (max) => ({ type: "text", max });
const phase = (max) => ({ type: "phase", max });
const list = (max, of) => ({ type: "list", max, of });
const object = (fields) => ({ type: "object", fields });

export const LANDING_CONTENT_SCHEMA = object({
  announcement: phase(TITLE),
  hero: object({
    badge: phase(SHORT),
    title: text(TITLE),
    subtitle: text(TEXT),
    countdownLabel: text(SHORT),
    primaryButton: text(SHORT),
    secondaryButton: text(SHORT),
    chips: list(2, text(60)),
    coverImageUrl: text(1000),
    coverImageId: text(255),
  }),
  // Section under the hero with the course trailer (the video itself is uploaded separately).
  trailerSection: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    text: text(TEXT),
  }),
  stats: list(6, object({ icon: text(16), title: text(60), text: text(120) })),
  painPoints: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    items: list(6, object({ icon: text(16), title: text(120), text: text(TEXT) })),
  }),
  howItWorks: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    steps: list(4, object({ title: text(120), text: text(TEXT) })),
  }),
  benefits: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    text: text(TEXT),
    items: list(12, text(TITLE)),
  }),
  curriculum: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    text: text(TEXT),
  }),
  pricing: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    // Line under the title, e.g. "One payment, lifetime access. The 50% pre-launch price ends on 11 Oct."
    text: phase(TEXT),
    badge: phase(SHORT),
    stepsTitle: text(SHORT),
    steps: object({ prelaunch: list(5, text(TITLE)), live: list(5, text(TITLE)) }),
    includes: list(10, text(TITLE)),
    button: text(SHORT),
    // Line under the price, e.g. "One-time payment · lifetime access · no subscription".
    note: text(TITLE),
  }),
  instructor: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    bio: text(LONG),
    imageUrl: text(1000),
    imageId: text(255),
    // Small figures under the bio, e.g. { value: "8 yrs", label: "of practice" }.
    stats: list(4, object({ value: text(20), label: text(60) })),
  }),
  testimonials: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    showScreenshots: { type: "bool" },
    quotes: list(6, object({ text: text(TEXT), name: text(80) })),
  }),
  faq: object({
    eyebrow: text(SHORT),
    title: text(TITLE),
    items: list(20, object({ question: text(TITLE), answer: text(LONG) })),
  }),
  finalCta: object({
    title: text(TITLE),
    text: text(TEXT),
    button: text(SHORT),
  }),
  mobileBar: object({ subtitle: text(80) }),
});

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const isEmptyValue = (value) =>
  value === "" ||
  value === false ||
  (Array.isArray(value) && value.length === 0) ||
  (value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(isEmptyValue));

/**
 * Cleans one value against the schema.
 * strict = true (saving): wrong types and too-long text are rejected with a clear message.
 * strict = false (reading): anything malformed is replaced by an empty value, so pages never break.
 */
const sanitize = (spec, value, path, strict) => {
  switch (spec.type) {
    case "text": {
      if (value === undefined || value === null) return "";
      if (typeof value !== "string") {
        if (strict) throw badRequest(`${path} must be text`);
        return "";
      }
      const trimmed = value.trim();
      if (trimmed.length > spec.max) {
        if (strict) throw badRequest(`${path} can't be longer than ${spec.max} characters`);
        return trimmed.slice(0, spec.max);
      }
      return trimmed;
    }
    case "bool":
      return value === true;
    case "phase":
      return {
        prelaunch: sanitize(text(spec.max), value?.prelaunch, `${path} (prelaunch)`, strict),
        live: sanitize(text(spec.max), value?.live, `${path} (live)`, strict),
      };
    case "object": {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      return Object.fromEntries(
        Object.entries(spec.fields).map(([key, fieldSpec]) => [key, sanitize(fieldSpec, source[key], `${path}.${key}`, strict)]),
      );
    }
    case "list": {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) {
        if (strict) throw badRequest(`${path} must be a list`);
        return [];
      }
      // Empty rows (e.g. an FAQ added but never filled) are dropped.
      const items = value.map((item, index) => sanitize(spec.of, item, `${path}[${index + 1}]`, strict)).filter((item) => !isEmptyValue(item));
      if (items.length > spec.max) {
        if (strict) throw badRequest(`${path} can have at most ${spec.max} items`);
        return items.slice(0, spec.max);
      }
      return items;
    }
    default:
      return null;
  }
};

/** Validates content sent by the admin panel. Throws 400 with the field path on bad input. */
export const sanitizeLandingContentInput = (input) => {
  const content = sanitize(LANDING_CONTENT_SCHEMA, input, "content", true);

  content.faq.items.forEach((item, index) => {
    if (!item.question || !item.answer) throw badRequest(`FAQ ${index + 1} needs both a question and an answer`);
  });
  content.instructor.stats.forEach((stat, index) => {
    if (!stat.value) throw badRequest(`Instructor figure ${index + 1} needs a value, e.g. "8 yrs"`);
  });
  content.testimonials.quotes.forEach((quote, index) => {
    if (!quote.text) throw badRequest(`Student quote ${index + 1} needs the quote text`);
  });
  ["stats", "painPoints.items", "howItWorks.steps"].forEach((key) => {
    const items = key.split(".").reduce((value, part) => value[part], content);
    items.forEach((item, index) => {
      if (!item.title) throw badRequest(`${key} item ${index + 1} needs a title`);
    });
  });
  if (!content.hero.coverImageUrl) content.hero.coverImageId = "";
  if (!content.instructor.imageUrl) content.instructor.imageId = "";

  return content;
};

/** Reads stored content into the full shape (every key present), tolerating old or malformed data. */
export const formatLandingContent = (stored) => sanitize(LANDING_CONTENT_SCHEMA, stored ?? {}, "content", false);

/** Image IDs (Cloudflare Images) referenced by the content, for clean-up when replaced or deleted. */
export const getLandingContentImageIds = (content) =>
  [content?.hero?.coverImageId, content?.instructor?.imageId].filter(Boolean);
