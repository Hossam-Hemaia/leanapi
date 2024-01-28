const dbConnect = require("../dbConnect/dbConnect");
const chatServices = require("../services/chatServices");
const utilities = require("../utilities/utils");

exports.getAllUsers = async (req, res, next) => {
  try {
    const companyId = req.userCompanyId;
    const branchId = req.userBranchId;
    const connection = await dbConnect.getConnection();
    const users = await connection.execute(
      `SELECT
        l.ID AS USER_ID,
        l.NAME,
        l.OCCUPATION,
        l.USERIMAGEURL,
        l.CONNECTIONSTATUS,
        l.COMPANY_ID,
        l.BRANCH_ID,
        COUNT(CASE WHEN ch.IS_READ = 0 THEN 1 END) AS UNREAD_MESSAGE_COUNT
      FROM
        LOGIN_TABLE l
      LEFT JOIN
        CHATHISTORY ch ON l.ID = ch.TO_PARTNERID AND ch.IS_READ = 0
      WHERE
        l.COMPANY_ID = ${companyId} AND l.BRANCH_ID = ${branchId}
      GROUP BY
        l.ID, l.NAME, l.OCCUPATION, l.USERIMAGEURL, l.CONNECTIONSTATUS, l.COMPANY_ID, l.BRANCH_ID`
    );
    const usersObjects = utilities.generateKeyValueObject(users);
    res.status(200).json({ success: true, users: usersObjects });
  } catch (err) {
    next(err);
  }
};

exports.postUploadFiles = async (req, res, next) => {
  try {
    const files = req.files;
    const attachments = [];
    if (files.length > 0) {
      for (let file of files) {
        let document = `${req.protocol}s://${req.get("host")}/${file.path}`;

        attachments.push({ doc: document, filename: file.originalname });
      }
    }
    res.status(201).json({ success: true, files: attachments });
  } catch (err) {
    next(err);
  }
};

// exports.getInitialChatHistory = async (req, res, next) => {
//   try {
//     const chatId = req.query.chatId;
//     const initHistory = await chatServices.getLatestChatHistory(chatId);
//     res.status(200).json({ success: true, history: initHistory });
//   } catch (err) {
//     next(err);
//   }
// };

exports.getOlderChatHistory = async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const partnerId = req.query.partnerId;
    const chatId = await chatServices.findCahtId(userId, partnerId);
    const page = req.query.page;
    const chatHistory = await chatServices.getOlderChatHistory(
      chatId,
      page,
      25
    );
    res.status(200).json({ success: true, history: chatHistory });
  } catch (err) {
    next(err);
  }
};

exports.postSendEmail = async (req, res, next) => {
  try {
    const { email, title, message } = req.body;
    await utilities.emailSender(email, title, message);
    res.status(201).json({ success: true, message: "email sent" });
  } catch (err) {
    next(err);
  }
};

exports.getNotificationsCount = async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const notificationsCount = await chatServices.getUnseenNotifications(
      userId
    );
    res.status(200).json({ success: true, count: notificationsCount });
  } catch (err) {
    throw err;
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.query.userId;
    const page = req.query.page;
    const notificationsHistory = await chatServices.getNotificationsHistory(
      userId,
      page,
      20
    );
    res.status(200).json({ success: true, history: notificationsHistory });
  } catch (err) {
    next(err);
  }
};

exports.postChangeNotificationStatus = async (req, res, next) => {
  try {
    const userId = req.body.userId;
    await chatServices.updateNotificationStatus(userId);
    res.status(201).json({ success: true });
  } catch (err) {
    throw err;
  }
};
