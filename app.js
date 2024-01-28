const path = require("path");
const express = require("express");
const compression = require("compression");
const dotenv = require("dotenv");
const cors = require("cors-express");
const multer = require("multer");
const slugify = require("slugify");

const dbConnect = require("./dbConnect/dbConnect");
const rdsClient = require("./dbConnect/redisConnect");

const authRouter = require("./routes/auth");
const filesRouter = require("./routes/files");
const chatRouter = require("./routes/chat");
const inventoryRouter = require("./routes/inventory");

const socketController = require("./controllers/socketController");

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "files");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + slugify(file.originalname));
  },
});

const app = express();
dotenv.config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.use("/files", express.static(path.join(__dirname, "files")));
app.use(multer({ storage: fileStorage }).array("files"));

// cron.schedule("0 2 * * *", async () => {
//   console.log("adding to chat history...");
//   const connection = await dbConnect.getConnection();
//   const chatsIdsTbl = await connection.execute(
//     `SELECT CHAT_ID FROM CHAT_IDENTIFIER`
//   );
//   for (let i = 0; i < chatsIdsTbl.rows.length; ++i) {
//     await chatServices.addToChatHistory(chatsIdsTbl.rows[i][0]);
//   }
// });

const initDataBaseConnection = async () => {
  await dbConnect.init();
};
initDataBaseConnection();
rdsClient.initRedis();

app.use(process.env.api, authRouter);
app.use(process.env.api, filesRouter);
app.use(process.env.api, chatRouter);
app.use(process.env.api, inventoryRouter);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  res.status(status).json({ success: false, message: message });
});

const server = app.listen(process.env.port, "localhost", () => {
  console.log("listening on port " + process.env.port);
});

const io = require("./socket").initIo(server);
io.on("connection", (socket) => {
  console.log("socket id " + socket.id + " connected!");
  socketController.userHandShake(socket);
  socketController.sendMessage(socket);
  socketController.userSeenMessages(socket);
  socketController.userDisconnect(socket);
  socketController.sendNotification(socket);
});
