const chatServices = require("../services/chatServices");
const rdsClient = require("../dbConnect/redisConnect");
const utilities = require("../utilities/utils");
const dbConnect = require("../dbConnect/dbConnect");

exports.updateNotificationSocket = async (socket) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    socket.on("update_socket", async (event) => {
      await cacheDB.hSet(
        `${event.userId}-sock`,
        "socket",
        JSON.stringify(socket.id)
      );
    });
  } catch (err) {
    throw err;
  }
};

exports.userHandShake = async (socket) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    socket.on("hand_shake", async (event) => {
      console.log("shaking hands with user " + event.userId);
      await chatServices.updateUserConnectionStatus(event);
      await cacheDB.hSet(
        `${event.userId}-s`,
        "socket",
        JSON.stringify(socket.id)
      );
      socket.userData = {
        userId: event.userId,
      };
      socket.broadcast.emit("user_status", {
        userOnline: "1",
        userId: Number(event.userId),
      });
    });
  } catch (err) {
    throw err;
  }
};

exports.sendMessage = (socket) => {
  try {
    socket.on("send_message", async (event) => {
      console.log("sending message");
      const date = new Date();
      const localDate = utilities.getLocalDate(date).toLocaleString();
      let chatId;
      if (event.chatId === "" || !chatId) {
        chatId = await chatServices.findCahtId(event.userId, event.partnerId);
      } else {
        chatId = event.chatId;
      }
      const msgInfo = {
        chatId,
        fromUserId: event.userId,
        toPartnerId: event.partnerId,
        message: event.message,
        mediaUrl: event.mediaUrl,
        date: localDate,
      };
      await chatServices.addToChatHistory(msgInfo);
      const unreadCount = await chatServices.getIsReadCount(
        chatId,
        event.userId
      );
      msgInfo.unreadCount = unreadCount;
      await chatServices.updateIsRead(chatId, event.partnerId);
      const receiverSocketId = await chatServices.getUserSocket(
        event.partnerId
      );
      socket
        .to(receiverSocketId)
        .emit("message_received", msgInfo, async (ack) => {
          if (!ack) {
            const notificationSocket = await chatServices.getNotificationSocket(
              msgInfo.toPartnerId
            );
            socket.to(notificationSocket).emit("notification_sent", {
              message: "You received new chat message!",
            });
            await chatServices.saveNotification(
              msgInfo.toPartnerId,
              "You received new chat message!"
            );
          }
        });
    });
  } catch (err) {
    throw new Error(err);
  }
};

exports.userSeenMessages = (socket) => {
  try {
    socket.on("scroll_bottom", async (event) => {
      const userId = event.userId;
      const partnerId = event.partnerId;
      const chatId = await chatServices.findCahtId(userId, partnerId);
      await chatServices.updateIsRead(chatId, partnerId);
      const unreadCount = await chatServices.getIsReadCount(
        chatId,
        event.partnerId
      );
      socket.emit("messages_seen", { unreadCount });
    });
  } catch (err) {
    throw err;
  }
};

exports.userDisconnect = async (socket) => {
  try {
    socket.on("disconnect", async () => {
      const data = {
        userId: Number(socket.userData.userId),
        status: 0,
      };
      await chatServices.updateUserConnectionStatus(data);
      await chatServices.deleteUserSocket(data.userId);
      socket.broadcast.emit("user_status", {
        userOnline: "0",
        userId: data.userId,
      });
    });
  } catch (err) {
    throw new Error(err);
  }
};

exports.sendNotification = async (socket) => {
  try {
    socket.on("send_notification", async (event) => {
      const userId = event.userId;
      const message = event.message;
      const notificationSocket = await chatServices.getNotificationSocket(
        userId
      );
      socket.to(notificationSocket).emit("notification_sent", { message });
      await chatServices.saveNotification(userId, message);
    });
  } catch (err) {
    throw err;
  }
};
