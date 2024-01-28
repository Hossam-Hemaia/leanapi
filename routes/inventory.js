const express = require("express");
const inventoryController = require("../controllers/inventoryController");

const router = express.Router();

router.get("/item/details", inventoryController.getItemDetails);

router.post(
  "/create/item/inventory",
  inventoryController.postCreateItemInventory
);

module.exports = router;
