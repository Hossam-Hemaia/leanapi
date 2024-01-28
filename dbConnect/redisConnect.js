const redis = require("redis");

let rdsClient;
module.exports = {
  initRedis: () => {
    rdsClient = redis.createClient();
    rdsClient.on("error", (err) => {
      console.log("Redis Client Error: " + err);
    });
    rdsClient.connect().then((result) => {
      console.log("Redis Client Connected");
    });
    return rdsClient;
  },
  getRedisConnection: () => {
    if (!rdsClient) {
      throw new Error("Redis Client Faild To Initialize");
    }
    return rdsClient;
  },
};
