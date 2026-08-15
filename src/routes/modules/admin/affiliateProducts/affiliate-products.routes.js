import { Router } from "express";

import { AdminValidateMiddleware } from "#src/middlewares/admin-validation.middleware.js";
import { ValidateRequestParametersMiddleware } from "#src/middlewares/express-validator.middleware.js";
import {
  deleteAffiliateProductController,
  fetchAllAffiliateProductsController,
  generateAffiliateProductsUploadSignature,
  handelAddAffiliateProductsController,
  handelEditAffiliateProductsController,
  reorderAffiliateProductsController,
} from "#src/routes/modules/admin/affiliateProducts/affiliate-products.controller.js";
import { body, query } from "express-validator";

const affiliateProductsRoute = Router();

affiliateProductsRoute.post(
  "/cloud/affiliate-products/signature",
  AdminValidateMiddleware,
  generateAffiliateProductsUploadSignature,
);

affiliateProductsRoute.post(
  "/add",
  body("title")?.exists(),
  body("description")?.exists(),
  body("status")?.exists(),
  body("affiliateLink")?.exists(),
  body("buttonTitle")?.exists(),
  body("thumbnailUrl")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  handelAddAffiliateProductsController,
);

affiliateProductsRoute.post(
  "/edit",
  query("id")?.exists(),
  body("description")?.exists(),
  body("status")?.exists(),
  body("affiliateLink")?.exists(),
  body("buttonTitle")?.exists(),
  body("thumbnailUrl")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  handelEditAffiliateProductsController,
);

affiliateProductsRoute.put(
  "/reorder",
  body("orderedIds").isArray({ min: 1 }),
  body("productId").optional().isString(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  reorderAffiliateProductsController,
);

affiliateProductsRoute.delete(
  "/delete",
  query("id")?.exists(),
  ValidateRequestParametersMiddleware,
  AdminValidateMiddleware,
  deleteAffiliateProductController,
);

affiliateProductsRoute.get("/fetch", AdminValidateMiddleware, fetchAllAffiliateProductsController);

export default affiliateProductsRoute;
