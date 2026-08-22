import {
  fetchPublishedAffiliateProductsService,
  getTopLandingAffiliateProductsService,
  getAllLandingAffiliateProductsService,
} from "#src/routes/modules/admin/affiliateProducts/affiliate-products.service.js";
import asyncHandler from "#src/utils/async-handler.util.js";

export const getAffiliateProductsController = asyncHandler(async (req, res) => {
  const products = await fetchPublishedAffiliateProductsService();

  return res.status(200).json({
    success: true,
    message: "Affiliate products fetched successfully",
    data: { products },
  });
});

export const getTopLandingAffiliateProductsController = asyncHandler(async (req, res) => {
  const products = await getTopLandingAffiliateProductsService();

  return res.status(200).json({
    success: true,
    message: "Top affiliate products fetched successfully",
    data: { products },
  });
});

export const getAllLandingAffiliateProductsController = asyncHandler(async (req, res) => {
  const products = await getAllLandingAffiliateProductsService();

  return res.status(200).json({
    success: true,
    message: "All affiliate products fetched successfully",
    data: { products },
  });
});
