const jwt = require("jsonwebtoken");
const dbConnect = require("../dbConnect/dbConnect");

exports.userIsAuth = async (req, res, next) => {
  let decodedToken;
  try {
    const token = req.get("Authorization").split(" ")[1];
    decodedToken = jwt.verify(token, process.env.SECRET);
  } catch (err) {
    err.statusCode = 403;
    next(err);
  }
  if (!decodedToken) {
    const error = new Error("Authorization faild!");
    error.statusCode = 401;
    next(error);
  }
  const connection = await dbConnect.getConnection();
  const user = await connection.execute(
    `SELECT * FROM LOGIN_TABLE WHERE ID = ${decodedToken.userId}`
  );
  if (user.length <= 0) {
    const error = new Error("Authorization faild!");
    error.statusCode = 403;
    next(error);
  }
  req.userId = decodedToken.userId;
  req.userCompanyId = decodedToken.companyId;
  req.userBranchId = decodedToken.branchId;
  next();
};
