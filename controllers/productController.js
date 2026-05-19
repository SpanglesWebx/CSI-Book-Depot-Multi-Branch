

// server/controllers/productController.js
const mongoose = require("mongoose");
const bwipjs = require("bwip-js");
const getNextProductCodeUtil = require("../utils/getNextProductCodeUtil");

const getNextProductCodePreview = require("../utils/getNextProductCodePreview");



// Helper: parse includeDisabled flag
const includeDisabledFlag = (req) => {
  const q = (req.query.includeDisabled || "").toString().toLowerCase();
  return q === "true" || q === "1";
};



const getProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop?._id || req.user?.shopId;
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    // const page = Math.max(1, Number(req.query.page) || 1);
    // const limitParam = Number(req.query.limit);
    // const limit = limitParam >= 0 ? limitParam : 5; // allow limit=0 for all
    // const search = req.query.search?.trim() || "";
    // const skip = (page - 1) * limit;


    const page = Math.max(1, Number(req.query.page) || 1);
    const limitParam = Number(req.query.limit);
    const limit = limitParam >= 0 ? limitParam : 10; // allow limit=0 for all
    const search = (req.query.search || "").trim();
    const skip = (page - 1) * limit;
    const includeDisabled = includeDisabledFlag(req);

    const statusFilter = req.query.status || "all";

    // 🔍 Build query
    const query = { shop: shopId };

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { code: regex },
        { name: regex },
        { category: regex },
        { batches: { $elemMatch: { batchNo: regex } } }, // ✅ FIXED batch search
        { batches: { $elemMatch: { randomCode: regex } } },
      ];
    }

    // ⭐ NEW: Apply status filter
    if (statusFilter === "active") {
      query.status = "active";
    } else if (statusFilter === "disabled") {
      query.status = "disabled";
    }


    // ⭐ Apply taxMode filter (ALWAYS)
    const taxFilter = req.query.taxMode || "all";

    if (taxFilter === "inclusive") {
      query.taxMode = "inclusive";
    } else if (taxFilter === "exclusive") {
      query.taxMode = "exclusive";
    }
    // ✅ Count for pagination
    const totalProducts = await Product.countDocuments(query);







    // ✅ Fetch paginated or full result (when searching)
    let productsQuery = Product.find(query)

      // .select("code name shortName category minQty taxPercent taxMode batches status")
      .select(
        "code name shortName category minQty taxPercent taxMode batches status stockHistory"
      )
      .sort({ status: 1, createdAt: -1 });
    if (search) {
      productsQuery = productsQuery.limit(500); // reasonable cap
    } else if (limit > 0) {
      productsQuery = productsQuery.skip(skip).limit(limit);
    }

    const products = await productsQuery.lean();

    // ✅ Aggregate stock stats
    const agg = await Product.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shopId) } },
      { $unwind: "$batches" },
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$batches.qty" },
          lowStockCount: {
            $sum: { $cond: [{ $lt: ["$batches.qty", "$minQty"] }, 1, 0] },
          },
        },
      },
    ]);

    const totalStock = agg[0]?.totalStock || 0;
    const lowStockCount = agg[0]?.lowStockCount || 0;

    const totalPages = limit > 0 ? Math.ceil(totalProducts / limit) || 1 : 1;

    products.forEach(p => {
      if (!p.status) p.status = "active";
    });


    res.json({
      products,
      page,
      limit,
      totalPages,
      totalProducts,
      totalStock,
      lowStockCount,
      searchMode: !!search,
    });
  } catch (err) {
    console.error("❌ getProducts error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch products", error: err.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { Product } = req.tenantModels;

    const id = req.params.id;
    const shopId = req.shop?._id || req.user?.shopId;

    if (!id) return res.status(400).json({ message: "Product ID is required" });
    if (!shopId) return res.status(400).json({ message: "Shop context missing" });

    // Fetch FULL product info including batches and stockHistory
    const product = await Product.findOne({ _id: id, shop: shopId })
      .select(
        "code name shortName category taxPercent taxMode minQty status batches stockHistory totalQty createdAt updatedAt"
      )
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error("❌ getProductById error:", err);
    res.status(500).json({
      message: "Failed to fetch product details",
      error: err.message,
    });
  }
};


const calculateTotalQty = (product) => {
  if (!product.batches || !Array.isArray(product.batches)) return 0;
  return product.batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
};




const createProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user?.shopId || req.body.shop;
    const data = req.body;

    if (!data.code || !data.name) {
      return res.status(400).json({ message: "Product code and name are required" });
    }

    // If batchNo exists in payload, treat as "create product + batch"
    const wantsBatch = !!(data.batchNo);

    // check existing product
    // let product = await Product.findOne({ shop: shopId, code: data.code });
    let product = data.code
      ? await Product.findOne({ shop: shopId, code: data.code })
      : null;


    // If product exists and wantsBatch -> add batch (but don't allow duplicate batchNo)
    if (product) {
      if (wantsBatch) {
        const batchExists = product.batches.some(b => b.batchNo === data.batchNo);
        if (batchExists) {
          return res.status(400).json({ message: "Batch already exists for product" });
        }

        // generate codes/barcode and push batch (use your helper functions)
        const randomCode = await generateUniqueEAN13();
        const barcode = await generateBarcode(randomCode);

        product.batches.push({
          batchNo: data.batchNo,
          qty: Number(data.qty || 0),
          mrp: Number(data.mrp || 0),
          salePrice: Number(data.salePrice || 0),
          taxPercent: Number(data.taxPercent || 0),
          taxMode: data.taxMode || "exclusive",
          randomCode,
          barcode,
          status: data.batchStatus || "active",
        });

        product.totalQty = calculateTotalQty(product.batches);

        // Record closing stock after adding batch
        const closing = product.totalQty;


        // ⭐ STORE STOCK MOVEMENT
        product.stockHistory.push({
          date: new Date(),
          openingStock: opening,
          closingStock: closing,
          change: closing - opening,
          reason: "batch-add",
          batchNo: data.batchNo
        });



        await product.save();
        return res.status(200).json(product);
      } else {
        // product exists, update product-level fields (no batch)
        product.name = data.name || product.name;
        product.shortName = data.shortName || product.shortName;
        product.category = data.category || product.category;
        product.minQty = typeof data.minQty !== 'undefined' ? data.minQty : product.minQty;
        product.taxPercent = typeof data.taxPercent !== 'undefined' ? data.taxPercent : product.taxPercent;
        product.taxMode = data.taxMode || product.taxMode;
        product.status = data.status || product.status;

        product.totalQty = calculateTotalQty(product.batches);
        await product.save();
        return res.status(200).json(product);
      }
    }

    // 🔐 ATOMIC product code generation (ONLY HERE)
    const productCode = await getNextProductCodeUtil(
      req.tenantModels.Counter,
      shopId
    );

    // Product doesn't exist -> create product doc
    const newProduct = new Product({
      shop: shopId,
      // code: data.code,/
      code: productCode,
      name: data.name,
      shortName: data.shortName || data.name,
      category: data.category || "",
      minQty: Number(data.minQty || 0),
      taxPercent: Number(data.taxPercent || 0),
      taxMode: data.taxMode || "exclusive",
      status: data.status || "active",
      batches: [],
    });

    // if payload contains batch data, add batch
    if (wantsBatch) {
      const randomCode = await generateUniqueEAN13();
      const barcode = await generateBarcode(randomCode);
      newProduct.batches.push({
        batchNo: data.batchNo,
        qty: Number(data.qty || 0),
        mrp: Number(data.mrp || 0),
        salePrice: Number(data.salePrice || 0),
        taxPercent: Number(data.taxPercent || 0),
        taxMode: data.taxMode || "exclusive",
        randomCode,
        barcode,
        status: data.batchStatus || "active",
      });
    }

    newProduct.totalQty = calculateTotalQty(newProduct.batches);


    // ⭐ NEW PRODUCT STOCK HISTORY (Opening = 0)
    newProduct.stockHistory.push({
      date: new Date(),
      openingStock: 0,
      closingStock: newProduct.totalQty,
      change: newProduct.totalQty,
      reason: "product-create",
      batchNo: data.batchNo || null
    });

    await newProduct.save();
    return res.status(201).json(newProduct);

  } catch (err) {
    console.error("❌ createProduct error:", err);
    res.status(500).json({ message: "Failed to create product", error: err.message });
  }
};



/**
 * PATCH /api/products/status
 * body: { code, status } -> status = "active" | "disabled"
 */
const updateProductStatus = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const { code, status } = req.body;

    if (!code || !["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid code or status" });
    }

    const updated = await Product.findOneAndUpdate(
      { shop: shopId, code },
      { $set: { status } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Product not found" });

    res.json(updated);
  } catch (err) {
    console.error("❌ updateProductStatus error:", err);
    res.status(500).json({ message: "Failed to update product status", error: err.message });
  }
};

/**
 * PATCH /api/products/batch-status
 * body: { code, batchNo, status } -> status = "active" | "disabled"
 */
const updateBatchStatus = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const { code, batchNo, status } = req.body;

    // if (!code || !batchNo || !["active", "disabled"].includes(status)) {
    //   return res.status(400).json({ message: "Invalid payload" });
    // }

    if (!code || batchNo === undefined || batchNo === null || !["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid payload" });
    }


    const product = await Product.findOne({ shop: shopId, code });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const batch = product.batches.find((b) => b.batchNo === batchNo);
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    batch.status = status;
    await product.save();

    res.json({ code, batchNo, status });
  } catch (err) {
    console.error("❌ updateBatchStatus error:", err);
    res.status(500).json({ message: "Failed to update batch status", error: err.message });
  }
};



/**
 * ----------------------
 * Get all batches for a product code
 * ----------------------
 */
const getBatchesByCode = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const code = req.params.code;

    const product = await Product.findOne({ shop: shopId, code });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product.batches || []);
  } catch (err) {
    console.error("❌ getBatchesByCode error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch batches", error: err.message });
  }
};

/**
 * ----------------------
 * Get a single product by code
 * ----------------------
 */
const getProductByCode = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const code = req.params.code;

    const product = await Product.findOne({ shop: shopId, code });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (err) {
    console.error("❌ getProductByCode error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch product", error: err.message });
  }
};

/**
 * ----------------------
 * Generate next product code
 * ----------------------
 */



const getNextProductCode = async (req, res) => {
  try {
    const { Counter } = req.tenantModels;
    const shopId = req.user.shopId;

    const nextCode = await getNextProductCodePreview(Counter, shopId);

    res.json({ nextCode });
  } catch (err) {
    res.status(500).json({
      message: "Failed to generate product code",
      error: err.message,
    });
  }
};


/**
 * ----------------------
 * Increment stock (one or multiple batches)
 * ----------------------
 */
const incrementStock = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    let { items } = req.body;

    if (!Array.isArray(items)) {
      if (!req.body.code || !req.body.batchNo || typeof req.body.qty === "undefined") {
        return res.status(400).json({ message: "Missing code/batchNo/qty" });
      }
      items = [req.body];
    }

    for (const item of items) {
      const qtyToAdd = Math.max(0, Number(item.qty) || 0);
      if (qtyToAdd === 0) continue;

      product.totalQty = calculateTotalQty(product);

      const previous = product.totalQty - Number(item.qty || 0);
      const change = Number(item.qty || 0);
      const closing = previous + change;

      // ⭐ RECORD STOCK MOVEMENT (MANUAL STOCK IN)
      product.stockHistory.push({
        date: new Date(),
        openingStock: previous,
        closingStock: closing,
        change,
        reason: "manual-increment",
        batchNo: item.batchNo
      });

      await product.save();


      await Product.updateOne(
        { shop: shopId, code: item.code, "batches.batchNo": item.batchNo },
        { $inc: { "batches.$.qty": qtyToAdd } }
      );
    }

    res.json({ message: "Stock incremented successfully" });
  } catch (err) {
    console.error("❌ incrementStock error:", err);
    res
      .status(500)
      .json({ message: "Failed to increment stock", error: err.message });
  }
};

/**
 * ----------------------
 * Decrement stock (one or multiple batches)
 * ----------------------
 */
const decrementStock = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    let { items } = req.body;

    if (!Array.isArray(items)) {
      if (!req.body.code || !req.body.batchNo || typeof req.body.qty === "undefined") {
        return res.status(400).json({ message: "Missing code/batchNo/qty" });
      }
      items = [req.body];
    }

    for (const item of items) {
      const qtyToReduce = Math.max(0, Number(item.qty) || 0);
      if (qtyToReduce === 0) continue;

      const product = await Product.findOne({
        shop: shopId,
        code: item.code,
        "batches.batchNo": item.batchNo,
      });

      if (!product) continue;

      const batch = product.batches.find((b) => b.batchNo === item.batchNo);
      if (!batch) continue;

      batch.qty = Math.max(0, batch.qty - qtyToReduce);
      product.totalQty = calculateTotalQty(product);

      const previous = product.totalQty + Number(item.qty || 0);
      const change = -Math.abs(Number(item.qty || 0));
      const closing = previous + change;

      // ⭐ RECORD STOCK MOVEMENT (Stock Out)
      product.stockHistory.push({
        date: new Date(),
        openingStock: previous,
        closingStock: closing,
        change,
        reason: "sale decrement",
        batchNo: item.batchNo
      });

      await product.save();
    }

    res.json({ message: "Stock decremented successfully" });
  } catch (err) {
    console.error("❌ decrementStock error:", err);
    res
      .status(500)
      .json({ message: "Failed to decrement stock", error: err.message });
  }
};




/** Utility: Escape regex special chars to avoid injection **/
const escapeRegex = (text = "") => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 🔍 Search products by NAME or SHORT NAME
 * Example: GET /api/search-products/search?name=pen
 */
// const searchProductsByName = async (req, res) => {
//   try {
//     const { name } = req.query;
//     if (!name) {
//       return res.status(400).json({ message: "Name query is required" });
//     }

//     // ✅ Use tenant model instead of global Product
//     const Product = req.tenantModels?.Product;
//     if (!Product) {
//       return res.status(400).json({ message: "Tenant Product model not found" });
//     }

//     const regex = new RegExp(escapeRegex(name), "i");

//     const includeDisabled = includeDisabledFlag(req);

//     const baseQuery = {
//       $or: [{ name: { $regex: regex } }, { shortName: { $regex: regex } }],
//     };

//     if (!includeDisabled) {
//       baseQuery.status = "active";
//     }


//     const products = await Product.find(baseQuery)
//       .select("code name shortName category minQty batches status")
//       .lean();

//     if (!products.length) {
//       return res.status(404).json({ message: "No products found" });
//     }





//     // const products = await Product.find({
//     //   $or: [{ name: { $regex: regex } }, { shortName: { $regex: regex } }],
//     // })
//     //   .select("code name shortName category minQty batches")
//     //   .lean();

//     // if (!products.length) {
//     //   return res.status(404).json({ message: "No products found" });
//     // }

//     // Filter out disabled batches unless includeDisabled
//     const filtered = products.map((p) => ({
//       ...p,
//       batches: includeDisabled ? p.batches : p.batches.filter((b) => b.status !== "disabled"),
//     }));

//     res.json(filtered);
//   }

//   //  res.json(products);
//   // }

//   catch (err) {
//     console.error("❌ Product name search error:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };


const searchProductsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: "Name query is required" });
    }

    const Product = req.tenantModels?.Product;
    if (!Product) {
      return res.status(400).json({ message: "Tenant Product model not found" });
    }

    const regex = new RegExp(escapeRegex(name), "i");

    // ⭐ FORCE ONLY ACTIVE PRODUCTS
    const baseQuery = {
      status: "active",
      $or: [
        { name: { $regex: regex } },
        { shortName: { $regex: regex } }
      ]
    };

    const products = await Product.find(baseQuery)
      .select("code name shortName category minQty batches taxPercent taxMode status")
      .lean();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    // ⭐ FORCE ONLY ACTIVE BATCHES
    const filtered = products
      .map((p) => ({
        ...p,
        batches: (p.batches || []).filter(
          (b) => b.status === "active" || b.status === undefined
        ),
      }))
      .filter((p) => p.batches.length > 0);

    res.json(filtered);
  } catch (err) {
    console.error("❌ Product name search error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * 🔢 Search products by CODE
 * Example: GET /api/search-products/search-by-code?code=P01
 */

// const searchProductsByCode = async (req, res) => {
//   try {
//     const { code } = req.query;
//     if (!code) {
//       return res.status(400).json({ message: "Code query is required" });
//     }

//     const Product = req.tenantModels?.Product;
//     if (!Product) {
//       return res.status(400).json({ message: "Tenant Product model not found" });
//     }

//     const includeDisabled = includeDisabledFlag(req);

//     const regex = new RegExp(escapeRegex(code), "i");

//     const baseQuery = {
//       $or: [
//         { code: { $regex: regex } },
//         { "batches.randomCode": { $regex: regex } },
//       ],
//     };

//     if (!includeDisabled) baseQuery.status = "active";

//     // If numeric exact randomCode search, allow direct match
//     if (/^\d+$/.test(code)) {
//       baseQuery.$or.push({ "batches.randomCode": code });
//     }

//     const products = await Product.find(baseQuery)
//       .select("code name shortName category minQty batches status")
//       .lean();

//     if (!products.length) {
//       return res.status(404).json({ message: "No products found" });
//     }

//     const filteredProducts = products.map((p) => {
//       const filteredBatches = includeDisabled
//         ? p.batches
//         : p.batches.filter(
//             (b) =>
//               (regex.test(b.batchNo || "") || regex.test(b.randomCode || "") || regex.test(p.code || "")) &&
//               b.status !== "disabled"
//           );

//       return {
//         ...p,
//         batches: filteredBatches.length ? filteredBatches : p.batches.filter((b) => b.status !== "disabled"),
//       };
//     });

//     res.json(filteredProducts);
//   } catch (err) {
//     console.error("❌ Product code/randomCode search error:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };
const searchProductsByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ message: "Code query is required" });
    }

    const Product = req.tenantModels?.Product;
    if (!Product) {
      return res.status(400).json({ message: "Tenant Product model not found" });
    }

    const regex = new RegExp(escapeRegex(code), "i");

    // ⭐ ONLY ACTIVE PRODUCTS
    const baseQuery = {
      status: "active",
      $or: [
        { code: { $regex: regex } },
        { "batches.randomCode": { $regex: regex } }
      ],
    };

    // ⭐ If numeric randomCode input → direct match
    if (/^\d+$/.test(code)) {
      baseQuery.$or.push({ "batches.randomCode": code });
    }

    const products = await Product.find(baseQuery)
      .select("code name shortName category minQty taxPercent taxMode  batches status")
      .lean();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    // ⭐ FILTER ONLY ACTIVE BATCHES
    const cleaned = products
      .map((p) => {
        const filteredBatches = (p.batches || []).filter(
          (b) =>
            (regex.test(b.batchNo || "") ||
              regex.test(b.randomCode || "") ||
              regex.test(p.code || "")) &&
            (b.status === "active" || b.status === undefined)
        );

        return {
          ...p,
          batches:
            filteredBatches.length > 0
              ? filteredBatches
              : (p.batches || []).filter(
                (b) => b.status === "active" || b.status === undefined
              ),
        };
      })
      .filter((p) => p.batches.length > 0);

    res.json(cleaned);
  } catch (err) {
    console.error("❌ Product code/randomCode search error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const updateMinQty = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const { code, minQty } = req.body;

    const updated = await Product.findOneAndUpdate(
      { shop: shopId, code },
      { $set: { minQty } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ updateMinQty error:", err);
    res.status(500).json({ message: "Failed to update minQty", error: err.message });
  }
};


const getLowStockProducts = async (req, res) => {
  const { Product } = req.tenantModels;
  const shopId = req.shop?._id || req.user?.shopId;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 25;
  const search = req.query.search || "";

  const skip = (page - 1) * limit;

  const searchMatch = search
    ? {
      $or: [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ],
    }
    : {};

  const pipeline = [
    { $match: { shop: new mongoose.Types.ObjectId(shopId), ...searchMatch } },
    { $addFields: { totalQty: { $sum: "$batches.qty" } } },
    { $match: { $expr: { $lte: ["$totalQty", "$minQty"] } } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const [items, countArr] = await Promise.all([
    Product.aggregate(pipeline),
    Product.aggregate([
      { $match: { shop: new mongoose.Types.ObjectId(shopId), ...searchMatch } },
      { $addFields: { totalQty: { $sum: "$batches.qty" } } },
      { $match: { $expr: { $lte: ["$totalQty", "$minQty"] } } },
      { $count: "count" },
    ]),
  ]);

  const totalProducts = countArr[0]?.count || 0;
  const totalPages = Math.ceil(totalProducts / limit);

  res.json({
    products: items,
    totalProducts,
    totalPages,
    page,
    limit,
  });
};






const updateProductDetails = async (req, res) => {
  try {
    const { Product } = req.tenantModels;

    const shopId =
      req.user?.shopId ||
      req.shop?._id;

    const {
      code,
      name,
      shortName,
      category,
      taxPercent,
      taxMode,
      minQty,
      status,
    } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Product code required" });
    }

    // build update object
    const update = {};

    if (name !== undefined) update.name = name;
    if (shortName !== undefined) update.shortName = shortName;
    if (category !== undefined) update.category = category;
    if (taxPercent !== undefined) update.taxPercent = Number(taxPercent);
    if (taxMode !== undefined) update.taxMode = taxMode;
    if (minQty !== undefined) update.minQty = Number(minQty);
    if (status !== undefined) update.status = status;

    console.log("UPDATE QUERY:", { shopId, code });
    console.log("UPDATE DATA:", update);

    const product = await Product.findOneAndUpdate(
      {
        shop: new mongoose.Types.ObjectId(shopId),
        code,
      },
      { $set: update },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    console.error("updateProductDetails error:", err);
    res.status(500).json({ message: "Failed to update product" });
  }
};

/**
 * -----------------------------------------------
 * Get ONLY active products + ONLY active batches
 * For Sales Bill & Order pages
 * -----------------------------------------------
 */
/**
 * -----------------------------------------------
 * Get ONLY active products + ONLY active batches
 * For Sales Bill & Order pages
 * -----------------------------------------------
 */


const getActiveProducts = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.shop?._id || req.user?.shopId;

    if (!shopId)
      return res.status(400).json({ message: "Shop context missing" });

    const search = (req.query.search || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Number(req.query.limit) || 500;
    const skip = (page - 1) * limit;

    // ⭐ ACTIVE PRODUCTS ONLY
    const query = {
      shop: shopId,
      $or: [
        { status: "active" },
        { status: { $exists: false } },
      ],
    };

    // ⭐ SEARCH CONDITIONS
    if (search) {
      const regex = new RegExp(search, "i");
      query.$and = [
        {
          $or: [
            { code: regex },
            { name: regex },
            { category: regex },
            { "batches.batchNo": regex },
            { "batches.randomCode": regex },
          ],
        },
      ];
    }

    // Fetch
    let productsQuery = Product.find(query).sort({ name: 1 });
    if (!search) productsQuery = productsQuery.skip(skip).limit(limit);
    const products = await productsQuery.lean();

    // ⭐ FIXED: RETURN COMPLETE BATCH STRUCTURE


    const cleaned = products.map((p) => ({
      ...p,
      batches: (p.batches || [])
        .filter((b) => b.status === "active" || b.status === undefined)
        .map((b) => ({
          batchNo: b.batchNo,
          qty: Number(b.qty || 0),
          mrp: Number(b.mrp || 0),
          salePrice: Number(b.salePrice || b.rate || 0),
          randomCode: b.randomCode || "",
          taxPercent: Number(p.taxPercent || 0),
          taxMode: (p.taxMode || "exclusive").toLowerCase(),
        })),
    }));

    // .filter((p) => p.batches.length > 0);

    const totalProducts = cleaned.length;
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      products: cleaned,
      page,
      limit,
      totalPages,
      totalProducts,
    });
  } catch (err) {
    console.error("❌ getActiveProducts error:", err);
    res.status(500).json({
      message: "Failed to fetch active products",
      error: err.message,
    });
  }
};




const generateUniqueRandomCode = async (Product) => {
  let code, exists;

  do {
    const base = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const sum = base.split("").reverse().map(Number)
      .reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    code = base + checkDigit;

    exists = await Product.findOne({ "batches.randomCode": code });
  } while (exists);

  return code;
};

const generateBarcode = async (value) => {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 2,
    height: 9,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
  return `data:image/png;base64,${png.toString("base64")}`;
};


// POST /api/products/add-batch
const addBatch = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;

    const { code, batchNo, qty, mrp, salePrice, value } = req.body;

    const product = await Product.findOne({ shop: shopId, code });
    if (!product) return res.status(404).json({ message: "Product not found" });

    // 🚫 DON'T ALLOW DUPLICATE BATCH
    const exists = product.batches.some(b => b.batchNo === batchNo);
    if (exists)
      return res.status(400).json({ message: "Batch already exists for this product" });

    // Generate randomCode + barcode
    const randomCode = await generateUniqueRandomCode(Product);
    const barcode = await generateBarcode(randomCode);

    // Add batch
    product.batches.push({
      batchNo,
      qty,
      mrp,
      salePrice,
      value,
      randomCode,
      barcode,
      status: "active",
    });

    product.totalQty = calculateTotalQty(product);

    const previous = product.totalQty - Number(qty || 0);
    const change = Number(qty || 0);
    const closing = previous + change;

    // ⭐ RECORD STOCK MOVEMENT FOR NEW BATCH
    product.stockHistory.push({
      date: new Date(),
      openingStock: previous,
      closingStock: closing,
      change,
      reason: "batch-add",
      batchNo
    });


    await product.save();
    res.json(product);
  } catch (err) {
    console.error("addBatch error:", err);
    res.status(500).json({ message: "Failed to add batch", error: err.message });
  }
};



// PATCH /api/products/update
const updateProduct = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;

    const { code, name, shortName, category, taxPercent, taxMode, minQty } = req.body;

    const updated = await Product.findOneAndUpdate(
      { shop: shopId, code },
      {
        $set: {
          name,
          shortName,
          category,
          taxPercent,
          taxMode,
          minQty
        }
      },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Product not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update product", error: err.message });
  }
};


// PATCH /api/products/update-batch-qty
const updateBatchQty = async (req, res) => {
  try {
    const { Product } = req.tenantModels;
    const shopId = req.user.shopId;
    const { code, batchNo, qty } = req.body;

    const updated = await Product.findOneAndUpdate(
      { shop: shopId, code, "batches.batchNo": batchNo },
      { $inc: { "batches.$.qty": qty } },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Product/batch not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update qty", error: err.message });
  }
};





const scanBarcode = async (req, res) => {
  try {
    const { code } = req.params;
    const { Product } = req.tenantModels;

    const shopId = req.user?.shopId || req.shop?._id;

    const product = await Product.findOne(
      {
        shop: shopId,
        status: "active",
        batches: {
          $elemMatch: {
            randomCode: code,
            status: "active"
          }
        }
      },
      {
        code: 1,
        name: 1,
        taxPercent: 1,
        taxMode: 1,
        batches: {
          $elemMatch: {
            randomCode: code,
            status: "active"
          }
        }
      }
    ).lean();

    if (!product) {
      return res.status(404).json({ message: "Not found or inactive" });
    }

    return res.json(product);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getProducts,
  createProduct,
  getBatchesByCode,
  getProductByCode,
  getNextProductCode,
  incrementStock,
  decrementStock,
  updateMinQty,
  getLowStockProducts,
  searchProductsByCode,
  searchProductsByName,
  updateBatchStatus,
  updateProductStatus,
  updateProductDetails,
  getActiveProducts,
  updateProduct,
  addBatch,
  updateBatchQty,
  scanBarcode

};





















