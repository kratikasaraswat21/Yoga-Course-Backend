import { getAffiliateProductsController } from "#src/routes/modules/affiliate-products/affiliate-products.controller.js";
import { Router } from "express";

const affiliateProductsRoutes = Router();

affiliateProductsRoutes.get("/", getAffiliateProductsController);

export default affiliateProductsRoutes;
