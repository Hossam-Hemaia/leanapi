const express = require("express");
const isAuth = require("../middleware/isAuth");
const chatController = require("../controllers/chatController");

const router = express.Router();

router.get("/all/users", isAuth.userIsAuth, chatController.getAllUsers);

router.post("/upload", isAuth.userIsAuth, chatController.postUploadFiles);

//router.get("/latest/chat/history", chatController.getInitialChatHistory);

router.get(
  "/old/chat/history",
  isAuth.userIsAuth,
  chatController.getOlderChatHistory
);

router.post("/send/email", chatController.postSendEmail);

router.get("/notifications/count", chatController.getNotificationsCount);

router.get("/notifications/history", chatController.getNotifications);

router.post(
  "/update/notification/status",
  chatController.postChangeNotificationStatus
);

module.exports = router;
