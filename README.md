# Uptime Sitesi

Bu proje, web sitelerinin uptime (çalışma süresi) takibi yapmayı sağlayan basit bir uygulamadır. Kullanıcılar, izlemek istedikleri bağlantıları ekleyebilir ve bu bağlantıların ping sürelerini görüntüleyebilir.

## Özellikler

- Kullanıcı kaydı ve girişi
- Bağlantı ekleme ve silme
- Ping sürelerini görüntüleme

## Gereksinimler

- Node.js (14 veya üstü)
- MongoDB Atlas hesabı (veya yerel MongoDB)

## Kurulum

### 1. Bağımlılıkları Yükleyin

npm install

### 3. .env Dosyasını Oluşturun

Proje kök dizininde bir .env dosyası oluşturun ve aşağıdaki gibi MongoDB bağlantı URL'sini ekleyin:
MONGODB_URI=mongodb://<kullanıcı_adı>:<şifre>@<sunucu_adresi>:<port>/<veritabanı_adı>?<query_parametreleri>

### 4. Uygulamayı Başlatın

npm start


