const UserRole = Object.freeze({
  USER: "USER",
  ADMIN: "ADMIN",
});

const UserStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  DELETED: "DELETED",
});

const CourseStatus = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
});

const OrderStatus = Object.freeze({
  CREATED: "CREATED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

const PaymentStatus = Object.freeze({
  CREATED: "CREATED",
  AUTHORIZED: "AUTHORIZED",
  CAPTURED: "CAPTURED",
  FAILED: "FAILED",
});

const PaymentGateway = Object.freeze({
  RAZORPAY: "RAZORPAY",
});

const EnrollmentStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
});

const RestrictionStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  REMOVED: "REMOVED",
});

const TokenPurpose = Object.freeze({
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  ADMIN_PASSWORD_RESET: "ADMIN_PASSWORD_RESET",
});

export {
  CourseStatus,
  EnrollmentStatus,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
  RestrictionStatus,
  TokenPurpose,
  UserRole,
  UserStatus,
};
