const oracleDB = require("oracledb");

let dbConnection;

module.exports = {
  init: () => {
    return new Promise((resolve, reject) => {
      oracleDB.initOracleClient();
      dbConnection = oracleDB.getConnection({
        user: process.env.db_username,
        password: process.env.db_password,
        connectionString: `${process.env.db_url}:${process.env.db_port}/${process.env.db_name}`,
      });
      console.log("connected to database");
      return resolve(dbConnection);
    });
  },
  getConnection: () => {
    if (!dbConnection) {
      throw new Error("Connection to database faild!");
    }
    return dbConnection;
  },
};
