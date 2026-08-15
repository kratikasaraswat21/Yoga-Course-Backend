import { fetchPublishedAffiliateProductsService } from "#src/routes/modules/admin/affiliateProducts/affiliate-products.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const getAffiliateProductsController = asyncHandler(async (req, res) => {
  const products = await fetchPublishedAffiliateProductsService();

  return res.status(200).json({
    success: true,
    message: "Affiliate products fetched successfully",
    data: { products },
  });
});
