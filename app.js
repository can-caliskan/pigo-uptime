/* Required */
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const ejs = require("ejs");
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const morgan = require("morgan");
const User = require("./models/user.js");
const Link = require("./models/link.js");
const ping = require("ping");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");

dotenv.config();
const conn = require("./mongoose.js");
conn();

const app = express();
let port = 3000;

app.use(methodOverride('_method'));
app.set("view engine", "ejs");
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Oturum ayarları
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // Gizli anahtar için çevresel değişken kullanın
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // HTTPS kullanıyorsanız true yapın
}));

/* Uptime Kontrolü */
const interval = setInterval(() => {
  Link.find({}, function (err, links) {
    if (err) {
      console.error(`Uptime kontrol hatası: ${err}`);
      return;
    }
    links.forEach((link) => {
      fetch(link.link)
        .then(() => {
          console.log(`Link aktif: ${link.link}`);
        })
        .catch((error) => {
          console.error(`Link hatası: ${error}`);
        });
    });
  });
}, 30000);

// Kullanıcı giriş kontrolü middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Kullanıcı giriş yapmamışsa kontrol eden middleware
const ensureNotAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return next();
  }
  res.redirect(`/user/${req.session.userId}`);
};

/* Servers */
app.get("/", (req, res) => {
  res.redirect('/login');
});

app.get('/register', ensureNotAuthenticated, (req, res) => {
  res.render("register", { error: null });
});

app.get("/login", ensureNotAuthenticated, (req, res) => {
  res.render("login", { error: null });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  // Kullanıcı adı ve şifre uzunluk kontrolü
  if (username.length < 3) {
    return res.render("register", { error: "Kullanıcı adı en az 3 karakter olmalıdır." });
  }

  if (password.length < 4) {
    return res.render("register", { error: "Şifre en az 4 karakter olmalıdır." });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.render("register", { error: "Bu kullanıcı adı zaten alınmış." });
    }

    const userObj = new User({
      username,
      password, // Şifre şifrelenmeli
    });

    await userObj.save();
    res.redirect(`/login`);
  } catch (error) {
    console.error(`Kullanıcı kaydetme hatası: ${error}`);
    res.render("register", { error: 'Kullanıcı kaydedilirken hata oluştu.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const result = await User.findOne({ username: req.body.username, password: req.body.password });
    if (result) {
      req.session.userId = result._id;
      return res.redirect(`/user/${result._id}`);
    }
    res.render("login", { error: `Böyle bir kullanıcı yok.` });
  } catch (error) {
    console.error(`Giriş hatası: ${error}`);
    res.render("login", { error: "Bir hata oluştu." });
  }
});


// Çıkış yapma işlemi
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(`Çıkış yapma hatası: ${err}`);
    }
    res.redirect('/login'); // Giriş sayfasına yönlendir
  });
});

// Kullanıcı sayfası
app.get('/user/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userResult = await User.findById(req.params.id);
    if (!userResult) {
      return res.render("pages/uptime", { error: "Kullanıcı bulunamadı", user: null, links: [] });
    }
    const links = await Link.find({ userId: req.params.id });
    const errorMessage = req.query.error || null;
    res.render("pages/uptime", { user: userResult, links: links, error: errorMessage });
  } catch (err) {
    console.error(err);
    res.render("pages/uptime", { error: "Bir hata oluştu", user: null, links: [] });
  }
});

// Link ekleme işlemi
app.post('/user/:id', ensureAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const url = req.body.link;

  // URL'nin geçerli olup olmadığını kontrol et
  if (!isValidUrl(url)) {
    const userResult = await User.findById(userId);
    const links = await Link.find({ userId });
    return res.render("pages/uptime", { user: userResult, links: links, error: 'Geçersiz URL formatı!' });
  }

  try {
    const userResult = await User.findById(userId);
    
    // Eğer kullanıcı admin değilse, ekleyebileceği maksimum link sayısı 3
    if (!userResult.isAdmin) {
      const userLinks = await Link.find({ userId });
      if (userLinks.length >= 3) {
        const links = await Link.find({ userId });
        return res.render("pages/uptime", { user: userResult, links: links, error: 'Admin olmadığınız için en fazla 3 link ekleyebilirsiniz!' });
      }
    }

    // Aynı link daha önce eklenmiş mi kontrol et
    const existingLink = await Link.findOne({ userId, link: url });
    if (existingLink) {
      const links = await Link.find({ userId });
      return res.render("pages/uptime", { user: userResult, links: links, error: 'Bu link zaten eklenmiş!' });
    }

    // URL'den domain'i al
    const domain = new URL(url).hostname;

    // Domain'e ping at
    const pingResult = await ping.promise.probe(domain);
    const pingTime = pingResult.time;

    if (!pingResult.alive) {
      throw new Error('Ping başarısız oldu.');
    }

    const link = new Link({
      userId,
      link: url,
      pingTime: pingTime
    });

    await link.save();
    res.redirect(`/user/${userId}`);
  } catch (error) {
    console.error(`Link kaydetme hatası: ${error}`);
    const userResult = await User.findById(userId);
    const links = await Link.find({ userId });
    return res.render("pages/uptime", { user: userResult, links: links, error: 'Link kaydedilirken hata oluştu: ' + error.message });
  }
});

// Link silme işlemi
app.delete('/user/:userId/link/:linkId', ensureAuthenticated, async (req, res) => {
  const { userId, linkId } = req.params;

  try {
    await Link.findByIdAndDelete(linkId);
    res.redirect(`/user/${userId}`);
  } catch (error) {
    console.error(`Link silme hatası: ${error}`);
    res.redirect(`/user/${userId}?error=Link silinirken hata oluştu.`);
  }
});

// URL geçerliliğini kontrol eden fonksiyon
const isValidUrl = (url) => {
  const pattern = new RegExp('^(https?:\\/\\/)?' +
    '((([a-zA-Z0-9\\-]+\\.)+[a-zA-Z]{2,})|' +
    'localhost|' +
    '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|' +
    '\\[?[a-fA-F0-9:\\.]+\\])' +
    '(\\:\\d+)?(\\/[-a-zA-Z0-9@:%_\\+.~#?&//=]*)?$');

  return !!pattern.test(url);
};



// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu ${port} portunda başlatıldı.`);
});
