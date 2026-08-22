import {
  getAffiliateProductsController,
  getTopLandingAffiliateProductsController,
  getAllLandingAffiliateProductsController,
} from "#src/routes/modules/affiliate-products/affiliate-products.controller.js";
import { Router } from "express";

const affiliateProductsRoutes = Router();

affiliateProductsRoutes.get("/", getAffiliateProductsController);
affiliateProductsRoutes.get("/top", getTopLandingAffiliateProductsController);
affiliateProductsRoutes.get("/all", getAllLandingAffiliateProductsController);

export default affiliateProductsRoutes;
