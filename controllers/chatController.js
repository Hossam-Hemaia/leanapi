const oracledb = require("oracledb");
const axios = require("axios");
const FormData = require("form-data");
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

/***********************************************
 * Wahtsapp Messaging API                      *
 ***********************************************/

exports.createMessagesQueue = async () => {
  try {
    console.log("creating message queue");
    const connection = await dbConnect.getConnection();
    const sql = `SELECT COMPANY_ID, COMPANY_NAME, TIME_TO_SEND, TXT_MASSEGE_
                 FROM COMPANY`;
    const companies = await connection.execute(
      sql,
      {},
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );
    // prepare the message queue
    if (companies.rows.length > 0) {
      const messagesQueue = [];
      for (let company of companies.rows) {
        let messageDetails = {};
        const detailSql = `SELECT EMAIL, MOB FROM V_CONTRACT_ALERT WHERE COMPANY_ID = :companyId`;
        const binds = {
          companyId: company.COMPANY_ID,
        };
        let contacts = await connection.execute(detailSql, binds, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        if (contacts.rows.length > 0) {
          let bulk = [];
          if (contacts.rows.length > 1) {
            for (let contact of contacts.rows) {
              bulk.push("+" + contact?.MOB);
            }
          } else {
            bulk = ["+" + contacts.rows[0]?.MOB];
          }
          messageDetails.companyName = company.COMPANY_NAME;
          messageDetails.timeToSend = utilities.getTimeInMilliseconds(
            company.TIME_TO_SEND
          );
          messageDetails.originalTime = company.TIME_TO_SEND;
          messageDetails.message = company.TXT_MASSEGE_;
          messageDetails.phoneNumber = "+" + contacts.rows[0]?.MOB;
          messageDetails.bulkNumbers = bulk.join(",");
          messageDetails.email = contacts.rows[0]?.EMAIL;
          messagesQueue.push(messageDetails);
        }
      }
      for (let message of messagesQueue) {
        setTimeout(async () => {
          const formData = new FormData();
          formData.append("appkey", "626c72de-4273-4aa1-bde3-5e991d424c2a");
          formData.append(
            "authkey",
            "7wuMasC0OyjGQHNSFQk1jM1MojSO88INdznh0NuHJ6le9vd4py"
          );
          formData.append("to", message.phoneNumber);
          formData.append("message", message.message);
          formData.append("to_array", message.bulkNumbers);
          const config = {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/x-www-form-urlencoded",
            },
          };
          const response = await axios.post(
            "https://wplus.my-sys.online/api/bluck-message",
            formData,
            config
          );
          if (response) {
            const date = new Date();
            const hours = date.getHours() + 1;
            const minutes = date.getMinutes();
            const time = `${hours}:${minutes}`;
            const msgSql = `INSERT INTO MASSEGE_LOG (TEL, MSG, M_TIME, STATUS)
                            VALUES(:tel, :msg, :messageTime, :status)`;
            const binds = {
              tel: message.phoneNumber,
              msg: message.message,
              messageTime: time,
              status: response.data[0].status_code,
            };
            await connection.execute(msgSql, binds);
            await connection.tpcCommit();
          }
        }, message.timeToSend);
      }
    }
  } catch (err) {
    throw err;
  }
};

exports.sendWhatsappMessage = async (req, res, next) => {
  try {
    const phoneNumbers = req.body.phoneNumbers;
    const message = req.body.message;
    const formData = new FormData();
    const config = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
    };
    const bulkNumbers = phoneNumbers.join(",");
    formData.append("appkey", "626c72de-4273-4aa1-bde3-5e991d424c2a");
    formData.append(
      "authkey",
      "7wuMasC0OyjGQHNSFQk1jM1MojSO88INdznh0NuHJ6le9vd4py"
    );
    formData.append("to", phoneNumbers[0]);
    formData.append("message", message);
    formData.append("to_array", bulkNumbers);
    const response = await axios.post(
      "https://wplus.my-sys.online/api/bluck-message",
      formData,
      config
    );
    console.log(response.data);
    res.status(201).json({ success: true, message: "Messages sent" });
  } catch (err) {
    next(err);
  }
};
