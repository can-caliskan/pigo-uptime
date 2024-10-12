const mongoose = require('mongoose');
require('dotenv').config(); // .env dosyasını yükleyin

// MongoDB bağlantı URI'sini çevresel değişkenden alın
const uri = process.env.MONGODB_URI;

const conn = () => {
  mongoose
    .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then((result) => {
      console.log('Mongoose Confirm');
    })
    .catch((err) => console.log(err));
}

module.exports = conn;
