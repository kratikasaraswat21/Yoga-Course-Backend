import { prisma } from "#src/lib/prisma.js";

export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "") || "course";

export const isValidSlug = (value) =>
  typeof value === "string" && value.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(value);

const isSlugTaken = async (slug, excludeCourseId) => {
  const course = await prisma.yogaCourse.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(course && course.id !== excludeCourseId);
};

// Returns `base`, or `base-2`, `base-3`… when it is already used by another course.
export const generateUniqueCourseSlug = async (value, excludeCourseId) => {
  const base = slugify(value);

  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidate = `${base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!(await isSlugTaken(candidate, excludeCourseId))) return candidate;
  }

  const error = new Error("Unable to generate a unique course URL. Please enter one manually.");
  error.statusCode = 409;
  throw error;
};

// Validates an admin-entered slug and makes sure no other course uses it.
export const ensureAvailableCourseSlug = async (slug, excludeCourseId) => {
  if (!isValidSlug(slug)) {
    const error = new Error(
      `Course URL can only contain lowercase letters, numbers and single hyphens (max ${SLUG_MAX_LENGTH} characters)`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (await isSlugTaken(slug, excludeCourseId)) {
    const error = new Error("This course URL is already used by another course");
    error.statusCode = 409;
    throw error;
  }

  return slug;
};
