import { utcToIstDate } from "#src/utils/ist-date.util.js";

export const OfferType = Object.freeze({
  NONE: "NONE",
  DISCOUNT: "DISCOUNT",
  PRELAUNCH: "PRELAUNCH",
});

// Same rounding rule the admin course form has always used for totalPayableAmount.
export const calculatePayableAmount = (price, discountPercentage, roundPayableAmount) => {
  const discountedPrice = Number(price) - (Number(price) * Number(discountPercentage)) / 100;
  return roundPayableAmount ? Math.round(discountedPrice) : Number(discountedPrice.toFixed(2));
};

export const getPrelaunchState = (course, now = new Date()) => {
  if (!course?.prelaunchEnabled || !course.prelaunchStartAt || !course.prelaunchEndAt) return "NONE";

  const startsAt = new Date(course.prelaunchStartAt);
  const endsAt = new Date(course.prelaunchEndAt);

  if (now < startsAt) return "UPCOMING";
  if (now < endsAt) return "LIVE";
  return "ENDED";
};

/**
 * The single source of truth for what a course costs right now.
 * During an active prelaunch window the prelaunch discount replaces the normal discount.
 */
export const getCoursePricing = (course, now = new Date()) => {
  const price = Number(course.price) || 0;
  const normalDiscountPercent = Number(course.discount) || 0;
  const normalPayableAmount = Number(course.totalPayableAmount) || 0;
  const prelaunchState = getPrelaunchState(course, now);

  const prelaunch =
    prelaunchState === "NONE"
      ? null
      : {
          state: prelaunchState,
          isActive: prelaunchState === "LIVE",
          isUpcoming: prelaunchState === "UPCOMING",
          startsAt: new Date(course.prelaunchStartAt).toISOString(),
          endsAt: new Date(course.prelaunchEndAt).toISOString(),
          startDate: utcToIstDate(course.prelaunchStartAt),
          endDate: utcToIstDate(course.prelaunchEndAt),
          discountPercent: Number(course.prelaunchDiscount) || 0,
          payableAmount: Number(course.prelaunchPayableAmount) || 0,
        };

  let offerType = OfferType.NONE;
  let discountPercent = 0;
  let payableAmount = price;

  if (prelaunch?.isActive) {
    offerType = OfferType.PRELAUNCH;
    discountPercent = prelaunch.discountPercent;
    payableAmount = prelaunch.payableAmount;
  } else if (normalDiscountPercent > 0) {
    offerType = OfferType.DISCOUNT;
    discountPercent = normalDiscountPercent;
    payableAmount = normalPayableAmount;
  }

  return {
    price,
    offerType,
    discountPercent,
    payableAmount,
    prelaunch,
    normalDiscount: {
      discountPercent: normalDiscountPercent,
      payableAmount: normalDiscountPercent > 0 ? normalPayableAmount : price,
    },
  };
};

// Prisma select for every field getCoursePricing reads.
export const coursePricingSelect = {
  price: true,
  discount: true,
  totalPayableAmount: true,
  prelaunchEnabled: true,
  prelaunchStartAt: true,
  prelaunchEndAt: true,
  prelaunchDiscount: true,
  prelaunchPayableAmount: true,
};

/**
 * User-facing course responses keep their existing price fields, but `discount` and
 * `totalPayableAmount` now describe the price that applies right now (including prelaunch),
 * so older clients keep showing the amount that checkout will actually charge.
 */
export const withCurrentPricing = (course, now = new Date()) => {
  const pricing = getCoursePricing(course, now);
  const {
    prelaunchEnabled,
    prelaunchStartAt,
    prelaunchEndAt,
    prelaunchDiscount,
    prelaunchPayableAmount,
    ...courseData
  } = course;

  return {
    ...courseData,
    price: pricing.price,
    discount: pricing.discountPercent,
    totalPayableAmount: pricing.payableAmount,
    pricing,
  };
};
