const express = require("express");
const barcodeController = require("../controllers/barcodeController");

const router = express.Router();

router.post("/set/paperSize", barcodeController.postSetPaperSize);

router.post("/generate/barcode", barcodeController.postGenerateBarcode);

router.post("/generate/range", barcodeController.postGenBulkBarcode);

module.exports = router;
