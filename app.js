const { Client, MessageMedia, NoAuth } = require('whatsapp-web.js');
const express = require("express");
const { body, validationResult } = require("express-validator");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const fs = require("fs");
const { phoneNumberFormatter } = require("./helpers/formatter");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const mime = require("mime-types");
const qrcodeTerm = require("qrcode-terminal");

const port = process.env.PORT || 8001;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

/**
 * BASED ON MANY QUESTIONS
 * Actually ready mentioned on the tutorials
 *
 * Many people confused about the warning for file-upload
 * So, we just disabling the debug for simplicity.
 */
app.use(
  fileUpload({
    debug: false,
  })
);

app.get("/", (req, res) => {
  res.sendFile("index.html", {
    root: __dirname,
  });
});

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process", // <- this one doesn't works in Windows
      "--disable-gpu",
      //"--proxy-server=proxy3.bri.co.id:1707",
    ],
  },
  authStrategy: new NoAuth(),
});

client.on("message", (msg) => {
  console.log(msg.body);
  if (msg.body == "!ping") {
    msg.reply("pong");
  } else if (msg.body == "good morning") {
    msg.reply("selamat pagi");
  } else if (msg.body == "!groups") {
    client.getChats().then((chats) => {
      const groups = chats.filter((chat) => chat.isGroup);

      if (groups.length == 0) {
        msg.reply("You have no group yet.");
      } else {
        let replyMsg = "*YOUR GROUPS*\n\n";
        groups.forEach((group, i) => {
          replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
        });
        replyMsg +=
          "_You can use the group id to send a message to the group._";
        msg.reply(replyMsg);
      }
    });
  } else if (msg.body == "!list"){
    const groupId = '120363041809044407@g.us'
    
    client.getChatById(groupId).then((groupchat) => {
      if(groupchat.isGroup) {
        let listParticipant = ''
        const groupchatParticipants = groupchat.participants;
        groupchatParticipants.forEach((participant) => {
          listParticipant +=  `${participant.id.user},`
        });
        msg.reply(listParticipant);
        // console.log(groupchatParticipants)
      }
    });
  }

  // NOTE!
  // UNCOMMENT THE SCRIPT BELOW IF YOU WANT TO SAVE THE MESSAGE MEDIA FILES
  // Downloading media
  // if (msg.hasMedia) {
  //   msg.downloadMedia().then(media => {
  //     // To better understanding
  //     // Please look at the console what data we get
  //     console.log(media);

  //     if (media) {
  //       // The folder to store: change as you want!
  //       // Create if not exists
  //       const mediaPath = './downloaded-media/';

  //       if (!fs.existsSync(mediaPath)) {
  //         fs.mkdirSync(mediaPath);
  //       }

  //       // Get the file extension by mime-type
  //       const extension = mime.extension(media.mimetype);

  //       // Filename: change as you want!
  //       // I will use the time for this example
  //       // Why not use media.filename? Because the value is not certain exists
  //       const filename = new Date().getTime();

  //       const fullFilename = mediaPath + filename + '.' + extension;

  //       // Save to file
  //       try {
  //         fs.writeFileSync(fullFilename, media.data, { encoding: 'base64' });
  //         console.log('File downloaded successfully!', fullFilename);
  //       } catch (err) {
  //         console.log('Failed to save the file:', err);
  //       }
  //     }
  //   });
  // }
});

client.initialize();
// client.initialize().catch(_ => _);

client.on("qr", (qr) => {
  qrcodeTerm.generate(qr, {small: true})
});

client.on("ready", () => {
  console.log("Whatsapp is ready!");
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

client.on("auth_failure", function (session) {
  console.log("Auth failure, restarting...");
});

client.on("disconnected", (reason) => {
  socket.emit("message", "Whatsapp is disconnected!");
  client.destroy();
  client.initialize();
});

// Socket IO
// io.on("connection", function (socket) {
//   socket.emit("message", "Connecting...");

//   client.on("qr", (qr) => {
//     console.log("QR RECEIVED", qr);
//     qrcode.generate
//     qrcode.toDataURL(qr, (err, url) => {
//       socket.emit("qr", url);
//       socket.emit("message", "QR Code received, scan please!");
//     });
//   });

//   client.on("ready", () => {
//     socket.emit("ready", "Whatsapp is ready!");
//     socket.emit("message", "Whatsapp is ready!");
//     console.log("Whatsapp is ready!");
//   });

//   client.on("authenticated", () => {
//     socket.emit("authenticated", "Whatsapp is authenticated!");
//     socket.emit("message", "Whatsapp is authenticated!");
//     console.log("AUTHENTICATED");
//   });

//   client.on("auth_failure", function (session) {
//     socket.emit("message", "Auth failure, restarting...");
//     console.log("Auth failure, restarting...");
//   });

//   client.on("disconnected", (reason) => {
//     socket.emit("message", "Whatsapp is disconnected!");
//     client.destroy();
//     client.initialize();
//   });
// });

const checkRegisteredNumber = async function (number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
};

// Send message
app.post(
  "/send-message",
  [body("number").notEmpty(), body("message").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped(),
      });
    }

    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    if (!checkRegisteredNumber) {
      return res.status(422).json({
        status: false,
        message: "The number is not registered",
      });
    }

    client
      .sendMessage(number, message)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

// Send media
app.post("/send-media", async (req, res) => {
  try {
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;
    const mediaPath = req.body.mediaPath;

    // Baca file gambar
    fs.readFile(mediaPath, (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ status: false, response: err });
      }

      // Tentukan tipe mime gambar Anda
      const mimetype = 'image/jpg'; // Ganti dengan tipe mime yang sesuai dengan gambar Anda

      // Buat objek MessageMedia dari data gambar
      const media = new MessageMedia(mimetype, data.toString('base64'), "Media");

      // Kirim pesan WhatsApp dengan gambar
      client.sendMessage(number, media, { caption: caption })
        .then((response) => {
          res.status(200).json({ status: true, response: response });
        })
        .catch((err) => {
          console.error('Error sending WhatsApp message:', err);
          res.status(500).json({ status: false, response: err });
        });
    });
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).json({ status: false, response: error });
  }
});

// // Send media
// app.post(
//   "/send-media", async (req, res) => {
//   const number = phoneNumberFormatter(req.body.number);
//   const caption = req.body.caption;
//   // const fileUrl = req.body.file;
//   const mediaPath = req.body.mediaPath;
//   fs.readFile(mediaPath, (err, data) => {
//     if (err) {
//       console.error('Error reading file:', err);
//       return res.status(500).json({ status: false, response: err });
//     }

//     const mimetype = 'image/jpeg'; // Ganti dengan tipe mime yang sesuai dengan gambar Anda

//     const media = new MessageMedia(mimetype, data.toString('base64'), "Media");

//     client
//       .sendMessage(number, media, { caption: caption })
//       .then((response) => {
//         res.status(200).json({ status: true, response: response });
//       })
//       .catch((err) => {
//         res.status(500).json({ status: false, response: err });
//       });
//   });
// });

  // const media = MessageMedia.fromFilePath('./image-example.png');
  // const file = req.files.file;
  // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
//   let mimetype;
//   const attachment = await axios
//     .get(fileUrl, {
//       responseType: "arraybuffer",
//     })
//     .then((response) => {
//       mimetype = response.headers["content-type"];
//       return response.data.toString("base64");
//     });

//   const media = new MessageMedia(mimetype, attachment, "Media");

//   client
//     .sendMessage(number, media, {
//       caption: caption,
//     })
//     .then((response) => {
//       res.status(200).json({
//         status: true,
//         response: response,
//       });
//     })
//     .catch((err) => {
//       res.status(500).json({
//         status: false,
//         response: err,
//       });
//     });
// });

app.post(
  "/send-group-media",
  [
    body("id").custom((value, { req }) => {
      if (!value && !req.body.name) {
        throw new Error("Invalid value, you can use `id` or `name`");
      }
      return true;
    }),
    body("message").notEmpty(),
  ],
  async (req, res) => {
    let chatId = req.body.id;
    const groupName = req.body.name;

    // Find the group by name
    if (!chatId) {
      const group = await findGroupByName(groupName);
      if (!group) {
        return res.status(422).json({
          status: false,
          message: "No group found with name: " + groupName,
        });
      }
      chatId = group.id._serialized;
    }

    const number = chatId;
    const caption = req.body.caption;
    const fileUrl = req.body.file;

    //const media = MessageMedia.fromFilePath('./image-example.png');
    const media = MessageMedia.fromFilePath(fileUrl);

    // const file = req.files.file;
    // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);

    // let mimetype;
    // const attachment = await axios.get(fileUrl, {
    //   responseType: 'arraybuffer'
    // }).then(response => {
    //   mimetype = response.headers['content-type'];
    //   return response.data.toString('base64');
    // });

    // const media = new MessageMedia(mimetype, attachment, 'Media');
    console.log("number:", number);
    client
      .sendMessage(number, media, {
        caption: caption,
      })
      .then((response) => {
        fs.unlink(fileUrl, (err) => {
          if (err) console.error(err);
          console.log("file:", fileUrl, " ,success deleted");
        });
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

app.post(
    "/send-group-media-via-url",
    [
      body("id").custom((value, { req }) => {
        if (!value && !req.body.name) {
          throw new Error("Invalid value, you can use `id` or `name`");
        }
        return true;
      }),
      body("message").notEmpty(),
    ],
    async (req, res) => {
      let chatId = req.body.id;
      const groupName = req.body.name;

      // Find the group by name
      if (!chatId) {
        const group = await findGroupByName(groupName);
        if (!group) {
          return res.status(422).json({
            status: false,
            message: "No group found with name: " + groupName,
          });
        }
        chatId = group.id._serialized;
      }

      const number = chatId;
      const caption = req.body.caption;
      const fileUrl = req.body.file;

      //const media = MessageMedia.fromFilePath('./image-example.png');
      // const media = MessageMedia.fromFilePath(fileUrl);

      // const file = req.files.file;
      // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);

      let mimetype;
      const attachment = await axios.get(fileUrl, {
        responseType: 'arraybuffer'
      }).then(response => {
        mimetype = response.headers['content-type'];
        return response.data.toString('base64');
      });

      const media = new MessageMedia(mimetype, attachment, 'Media');
      console.log("number:", number);
      client
          .sendMessage(number, media, {
            caption: caption,
          })
          .then((response) => {
            fs.unlink(fileUrl, (err) => {
              if (err) console.error(err);
              console.log("file:", fileUrl, " ,success deleted");
            });
            res.status(200).json({
              status: true,
              response: response,
            });
          })
          .catch((err) => {
            console.error(err);
            res.status(500).json({
              status: false,
              response: err,
            });
          });
    }
);

const findGroupByName = async function (name) {
  const group = await client.getChats().then((chats) => {
    return chats.find(
      (chat) => chat.isGroup && chat.name.toLowerCase() == name.toLowerCase()
    );
  });
  return group;
};

// Send message to group
// You can use chatID or group name, yea!
app.post(
  "/send-group-message",
  [
    body("id").custom((value, { req }) => {
      if (!value && !req.body.name) {
        throw new Error("Invalid value, you can use `id` or `name`");
      }
      return true;
    }),
    body("message").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped(),
      });
    }

    let chatId = req.body.id;
    const groupName = req.body.name;
    const message = req.body.message;

    // Find the group by name
    if (!chatId) {
      const group = await findGroupByName(groupName);
      if (!group) {
        return res.status(422).json({
          status: false,
          message: "No group found with name: " + groupName,
        });
      }
      chatId = group.id._serialized;
    }

    client
      .sendMessage(chatId, message)
      .then((response) => {
        res.status(200).json({
          status: true,
          response: response,
        });
      })
      .catch((err) => {
        res.status(500).json({
          status: false,
          response: err,
        });
      });
  }
);

// Clearing message on spesific chat
app.post("/clear-message", [body("number").notEmpty()], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped(),
    });
  }

  const number = phoneNumberFormatter(req.body.number);

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: "The number is not registered",
    });
  }

  const chat = await client.getChatById(number);

  chat
    .clearMessages()
    .then((status) => {
      res.status(200).json({
        status: true,
        response: status,
      });
    })
    .catch((err) => {
      res.status(500).json({
        status: false,
        response: err,
      });
    });
});

server.listen(port, function () {
  console.log("App running on *: " + port);
});
