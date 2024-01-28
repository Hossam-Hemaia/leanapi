const crypto = require("crypto");
const oracledb = require("oracledb");
const dbConnect = require("../dbConnect/dbConnect");
const rdsClient = require("../dbConnect/redisConnect");

exports.updateUserConnectionStatus = async (data) => {
  try {
    const connection = await dbConnect.getConnection();
    await connection.execute(
      `UPDATE LOGIN_TABLE SET CONNECTIONSTATUS = ${data.status} WHERE ID = ${data.userId}`
    );
    await connection.tpcCommit();
  } catch (err) {
    throw new Error(err);
  }
};

exports.getUserSocket = async (userId) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    const user = await cacheDB.hGetAll(`${userId}-s`);
    const socketId = JSON.parse(user.socket);
    return socketId;
  } catch (err) {
    throw new Error(err);
  }
};

exports.getNotificationSocket = async (userId) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    const user = await cacheDB.hGetAll(`${userId}-sock`);
    const socketId = JSON.parse(user.socket);
    return socketId;
  } catch (err) {
    throw new Error(err);
  }
};

exports.deleteUserSocket = async (userId) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    await cacheDB.del(`${userId}-s`);
  } catch (err) {
    throw new Error(err);
  }
};

exports.findCahtId = async (userId, partnerId) => {
  try {
    const connection = await dbConnect.getConnection();
    const chatIdTbl = await connection.execute(
      `SELECT CHAT_ID FROM CHAT_IDENTIFIER
       WHERE (PARTNER1_ID = ${userId} AND PARTNER2_ID = ${partnerId})
       OR (PARTNER1_ID = ${partnerId} AND PARTNER2_ID = ${userId})`
    );
    if (chatIdTbl.rows.length < 1) {
      const chatId = crypto.randomBytes(6).toString("hex");
      await connection.execute(`INSERT INTO CHAT_IDENTIFIER (CHAT_ID, PARTNER1_ID, PARTNER2_ID)
      VALUES('${chatId}', ${userId}, ${partnerId})`);
      await connection.tpcCommit();
      return chatId;
    } else {
      return chatIdTbl.rows[0][0];
    }
  } catch (err) {
    throw err;
  }
};

exports.addToTempHistory = async (chatId, msgInfo) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    await cacheDB.rPush(`${chatId}`, JSON.stringify(msgInfo));
  } catch (err) {
    throw err;
  }
};

exports.addToChatHistory = async (chatInfo) => {
  try {
    console.log(chatInfo);
    // const cacheDB = rdsClient.getRedisConnection();
    // const tempChatHistory = await cacheDB.lRange(`${chatId}`, 0, -1);
    const connection = await dbConnect.getConnection();
    // if (tempChatHistory.length < 1 || !tempChatHistory) {
    //   return;
    // }
    // for (let i = 0; i < tempChatHistory.length; ++i) {
    //   let chatInfo = JSON.parse(tempChatHistory[i]);
    await connection.execute(
      `INSERT INTO CHATHISTORY (FROM_USERID, TO_PARTNERID, MESSAGE, MEDIAURL, DATE_TIME, CHAT_ID)
         VALUES (${chatInfo.fromUserId}, ${chatInfo.toPartnerId}, '${chatInfo.message}', 
         '${chatInfo.mediaUrl}', '${chatInfo.date}', '${chatInfo.chatId}')`
    );
    await connection.tpcCommit();
    // }
    // await cacheDB.del(`${chatId}`);
  } catch (err) {
    throw err;
  }
};

exports.getLatestChatHistory = async (chatId) => {
  try {
    const cacheDB = rdsClient.getRedisConnection();
    const tempChatHistory = await cacheDB.lRange(`${chatId}`, 0, -1);
    const initialChatHistory = [];
    for (let i = 0; i < tempChatHistory.length; ++i) {
      let chatInfo = JSON.parse(tempChatHistory[i]);
      initialChatHistory.push(chatInfo);
    }
    return initialChatHistory;
  } catch (err) {
    throw err;
  }
};

exports.updateIsRead = async (chatId, userId) => {
  try {
    const connection = await dbConnect.getConnection();
    const updateSql = `
      UPDATE CHATHISTORY
      SET IS_READ = 1
      WHERE CHAT_ID = :chatId
      AND FROM_USERID = :userId
    `;
    const updateBinds = {
      chatId: chatId,
      userId: userId,
    };
    await connection.execute(updateSql, updateBinds);
    await connection.tpcCommit();
  } catch (err) {
    throw err;
  }
};

exports.getOlderChatHistory = async (chatId, pageNumber, pageSize) => {
  try {
    const connection = await dbConnect.getConnection();
    // Update all unread messages to read messages first
    const updateSql = `
      UPDATE CHATHISTORY
      SET IS_READ = 1
      WHERE CHAT_ID = :chatId
    `;
    const updateBinds = {
      chatId: chatId,
    };
    await connection.execute(updateSql, updateBinds);
    await connection.tpcCommit();
    const offset = (pageNumber - 1) * pageSize;
    // Your SQL query with OFFSET and FETCH clauses
    const sql = `
      SELECT CHAT_ID AS "chatId",
      FROM_USERID AS "fromUserId",
      TO_PARTNERID AS "toPartnerId",
      MESSAGE AS "message",
      MEDIAURL AS "mediaUrl",
      DATE_TIME AS "date",
      IS_READ 
      FROM CHATHISTORY
      WHERE CHAT_ID = :chatid
      ORDER BY CREATED DESC
      OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY
    `;
    // Bind parameters
    const binds = {
      chatid: chatId,
      offset: offset,
      pageSize: pageSize,
    };
    // Execute the query
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    // Process the result and return it
    return result.rows.reverse();
  } catch (err) {
    throw err;
  }
};

exports.getIsReadCount = async (chatId, userId) => {
  try {
    if (chatId === "") {
      return;
    }
    const connection = await dbConnect.getConnection();
    const sql = `SELECT CHAT_ID, FROM_USERID,
    COUNT(CASE WHEN IS_READ = 0 THEN 1 END) AS UNREAD_MESSAGE_COUNT
    FROM CHATHISTORY
    WHERE CHAT_ID = :chatId
    AND FROM_USERID = :userId
    GROUP BY CHAT_ID, FROM_USERID`;
    const binds = {
      chatId: chatId,
      userId: userId,
    };
    const userUnread = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    if (userUnread.rows.length > 0) {
      return userUnread.rows[0];
    } else {
      return;
    }
  } catch (err) {
    throw err;
  }
};

exports.saveNotification = async (userId, message) => {
  try {
    const connection = await dbConnect.getConnection();
    await connection.execute(
      `INSERT INTO NOTIFICATIONS (USERID, MESSAGE) VALUES('${userId}', '${message}')`
    );
    await connection.tpcCommit();
  } catch (err) {
    throw err;
  }
};

exports.getUnseenNotifications = async (userId) => {
  try {
    const connection = await dbConnect.getConnection();
    const notificationsCount = await connection.execute(
      `SELECT USERID,
      COUNT(CASE WHEN NOTIFICATION_STATU = 0 THEN 1 END) AS UNREAD_NOTIFICATIONS_COUNT
      FROM NOTIFICATIONS
      WHERE USERID = :userId
      GROUP BY USERID`,
      { userId: userId },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );
    return notificationsCount.rows;
  } catch (err) {
    throw err;
  }
};

exports.getNotificationsHistory = async (userId, pageNumber, pageSize) => {
  try {
    const connection = await dbConnect.getConnection();
    const offset = (pageNumber - 1) * pageSize;
    // Your SQL query with OFFSET and FETCH clauses
    const sql = `
      SELECT * 
      FROM NOTIFICATIONS
      WHERE USERID = :userId
      ORDER BY CREATED ASC
      OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY
    `;
    // Bind parameters
    const binds = {
      userId: userId,
      offset: offset,
      pageSize: pageSize,
    };
    // Execute the query
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    // Process the result and return it
    return result.rows.reverse();
  } catch (err) {
    throw err;
  }
};

exports.updateNotificationStatus = async (userId) => {
  try {
    const connection = await dbConnect.getConnection();
    await connection.execute(
      `UPDATE NOTIFICATIONS SET NOTIFICATION_STATU = 1 WHERE USERID = '${userId}'`
    );
    await connection.tpcCommit();
  } catch (err) {
    throw err;
  }
};
