import { Router } from "express";

import { UserValidateMiddleware } from "#src/middlewares/verify-user.middleware.js";
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
  UserValidateMiddleware,
  generateAffiliateProductsUploadSignature,
);

affiliateProductsRoute.post(
  "/add",
  body("title")?.exists(),
  body("description")?.exists(),
  body("status")?.exists(),
  body("productsLink")?.exists(),
  body("buttonTitle")?.exists(),
  body("thumbnailUrl")?.exists(),
  UserValidateMiddleware,
  handelAddAffiliateProductsController,
);

affiliateProductsRoute.post(
  "/edit",
  query("id")?.exists(),
  body("description")?.exists(),
  body("status")?.exists(),
  body("productsLink")?.exists(),
  body("buttonTitle")?.exists(),
  body("thumbnailUrl")?.exists(),
  UserValidateMiddleware,
  handelEditAffiliateProductsController,
);

affiliateProductsRoute.put(
  "/reorder",
  body("orderedIds").isArray({ min: 1 }),
  body("productId").optional().isString(),
  UserValidateMiddleware,
  reorderAffiliateProductsController,
);

affiliateProductsRoute.delete(
  "/delete",
  query("id")?.exists(),
  UserValidateMiddleware,
  deleteAffiliateProductController,
);

affiliateProductsRoute.get("/fetch", UserValidateMiddleware, fetchAllAffiliateProductsController);

export default affiliateProductsRoute;
