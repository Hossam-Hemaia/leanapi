const express = require("express");
const filesController = require("../controllers/filesController");

const router = express.Router();

router.get("/get/invoice", filesController.getInvoice);

router.post("/whatsapp/contacts/optin", filesController.whatsappOptIn);

router.post("/whatsapp/send/message", filesController.whatsappMessage);

router.get("/convert/pdf", filesController.convertHtmlToPdf);

module.exports = router;
