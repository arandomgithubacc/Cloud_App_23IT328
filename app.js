require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo").default || require("connect-mongo");
const { engine } = require("express-handlebars");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 1. Đa luồng kết nối Database (Read & Write)
const readConn = mongoose.createConnection(process.env.MONGODB_URI_READ);
const writeConn = mongoose.createConnection(process.env.MONGODB_URI_WRITE);

readConn.on("connected", () =>
  console.log("MongoDB READ Connected successfully"),
);
writeConn.on("connected", () =>
  console.log("MongoDB WRITE Connected successfully"),
);

// Schema Sách
const bookSchema = new mongoose.Schema({
  bookCode: String,
  title: String,
  basePrice: Number,
  finalPrice: Number,
});

// Models định tuyến quyền truy vấn
const BookRead = readConn.model("Book", bookSchema);
const BookWrite = writeConn.model("Book", bookSchema);

// 2. Cấu hình Session tập trung trên MongoDB Atlas (Stateless Architecture)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI_WRITE,
      collectionName: "sessions",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  }),
);

// Cấu hình View Engine Handlebars
app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");

// --- THÔNG TIN MSSV 23IT328 ---
// Chữ số cuối = 8 => VAT = (8 + 6)% = 14%
// 3 số cuối = 328 => Tiền tố bắt buộc = 328
const STUDENT_LAST_DIGIT = 8;
const VAT_RATE = (STUDENT_LAST_DIGIT + 6) / 100; // 0.14 (14%)
const MSSV_PREFIX = "328";

// Route Xem danh sách (Định tuyến vào Read Connection)
app.get("/", async (req, res) => {
  try {
    const books = await BookRead.find().lean();
    res.render("home", {
      books,
      studentInfo: {
        fullName: "Dư Thị Như Yến",
        mssv: "23IT328",
        vatPercent: STUDENT_LAST_DIGIT + 6, // 14%
      },
    });
  } catch (err) {
    res.status(500).send("Lỗi đọc dữ liệu: " + err.message);
  }
});

// Route Thêm sách mới (Định tuyến vào Write Connection)
app.post("/add-book", async (req, res) => {
  const { bookCode, title, basePrice } = req.body;

  // Bộ lọc kiểm tra tiền tố 3 số cuối MSSV (328)
  if (!bookCode.startsWith(MSSV_PREFIX)) {
    return res
      .status(400)
      .send(
        `Mã sản phẩm bắt buộc phải có tiền tố là 3 số cuối MSSV (${MSSV_PREFIX})!`,
      );
  }

  const price = parseFloat(basePrice);
  const finalPrice = price + price * VAT_RATE; // Tính giá sau thuế (VAT 14%)

  try {
    const newBook = new BookWrite({
      bookCode,
      title,
      basePrice: price,
      finalPrice,
    });
    await newBook.save();
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Lỗi ghi dữ liệu: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`),
);
