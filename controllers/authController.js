const jwt = require("jsonwebtoken");
const dbConnect = require("../dbConnect/dbConnect");
const chatServices = require("../services/chatServices");
const utilities = require("../utilities/utils");

exports.userLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log(username, password);
    const connection = await dbConnect.getConnection();
    const user = await connection.execute(
      `SELECT * FROM LOGIN_TABLE WHERE USERNAME = '${username}' AND PASSWORD = ${password}`
    );
    if (user.rows.length < 0) {
      const error = new Error("Invalid username or password");
      error.statusCode = 401;
      throw error;
    }
    const userObject = utilities.generateKeyValueObject(user);
    const token = jwt.sign(
      {
        userId: userObject[0].ID,
        companyId: userObject[0].COMPANY_ID,
        branchId: userObject[0].BRANCH_ID,
      },
      process.env.SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({ success: true, user: userObject[0], token });
  } catch (err) {
    next(err);
  }
};

// exports.userLoggedOut = async (req, res, next) => {
//   try {
//     const { userId, status } = req.body;
//     const data = {
//       userId,
//       status,
//     };
//     console.log("logged out", data);
//     const io = require("../socket").getIo();
//     await chatServices.updateUserConnectionStatus(data);
//     await chatServices.deleteUserSocket(userId);
//     io.emit("user_offline", { userOnline: false, userId: userId });
//   } catch (err) {
//     next(err);
//   }
// };

exports.getVerifyToken = async (req, res, next) => {
  const token = req.query.token;
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.SECRET);
  } catch (err) {
    err.statusCode = 403;
    next(err);
  }
  if (!decodedToken) {
    const error = new Error("Authorization faild!");
    error.statusCode = 401;
    next(error);
  } else {
    res.status(200).json({
      success: true,
      decodedToken: decodedToken,
    });
  }
};
