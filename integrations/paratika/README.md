# Kart Çekimleri ve Paratika

Mevcut Kart Çekimleri formu Paraşüt cari hareketi kaydetmeye devam eder. Bu form karttan para çekmez. Ek Paratika bölümü panelde kart girişi ve 3D Secure akışını başlatır; yalnız banka sorgusuyla doğrulanan canlı tahsilat aynı cari için Paraşüt'e ve mevcut Kart Çekimleri listesine kaydedilir. Mevcut çekimler için yeniden ödeme bağlantısı oluşturmayın.

## Hazırlık durumu

Kod hazır; gerçek tahsilat yapılmadı, veritabanı kurulumu ve canlı yayın uygulanmadı. Varsayılan olarak ödeme başlatma kapalıdır. Paratika API kullanıcı bilgileri olmadan çalışmaz.

1. Niba veritabanında `setup.sql` dosyasını bir kez uygulayın. Başka Supabase projesine uygulamayın. Mevcut manuel kayıtlar korunur.
2. Ortam ayarlarını güvenli yayın ayarlarına girin. Parola ve anahtarları koda veya sohbete yazmayın.
3. Test ortamında başarılı/başarısız ödeme, sekmenin kapanması, tekrarlanan dönüş ve Paraşüt bağlantı kesintisi senaryolarını kontrol edin. Test ödemeleri Paraşüt'e aktarılmaz.
4. Paratika hesabında Direct Post 3D yetkisini ve dönüş adresini sağlayıcıyla doğrulayın. Kart bilgileri panelde girilir ve doğrudan Paratika’ya gönderilir; Niba sunucusu kart bilgisi almaz.
5. Canlı geçişte ayrı onayla canlı modu ve iki etkinleştirme ayarını açın.

## İki üye iş yeri ve ayarlar

- 10013929: Tarım POS
- 10013922: Normal POS

`settings.env.example` güvenli ayar isimlerini içerir. API bilgileri test/canlı ve üye iş yeri başına ayrı tutulur; başka hesaba otomatik geri dönüş yoktur. Canlı tahsilat için ayrıca iki etkinleştirme ayarı açılmalıdır. İki hesabın API bilgileri henüz eklenmedi.

Kart formu panel içinde, analiz kodu yüklemeyen ayrı bir belge olarak açılır. Kart numarası/CVV doğrudan Paratika Direct Post 3D adresine gönderilir. Niba API'sine tam kart veya CVV kabul edilmez. Taksit sorgusuna yalnız ilk 8 hane gönderilir; saklanmaz. E-posta kullanıcıdan istenmez; Paratika müşteri bilgilendirme ayarı e-posta gerektiriyorsa canlı geçişten önce sağlayıcıyla çözülmelidir.

Taksit seçenekleri QUERYINSTALLMENT ile seçilen hesap ve kart ön eki için alınır; ödeme oturumu açılırken sunucuda tekrar doğrulanır. SESSIONTOKEN'da ALLOWEDINSTALLMENTS ve IGNORECUSTOMERCOMMISSION=YES kullanılır. Böylece tahsilat miktarı müşteriye komisyon eklenmeden oluşturulur. Sağlayıcı kabulü test edilmeden bu davranış canlıda doğrulanmış sayılmaz.

QUERYINSTALLMENT `customerCostCommissionRate` alanı Niba'nın komisyonu değildir. Niba komisyonu için `PARATIKA_VERIFIED_TARIFFS_JSON` içindeki sağlayıcı/sözleşme ile doğrulanmış, hesap+ortam+sistem+taksit bazlı oran kullanılır. Tanımsızsa oran ve net tutar gösterilmez. Bunlar yetkili sunucu ayarlarıdır; kullanıcı formdan değiştiremez. Hesaplanan net, mutabakat öncesi tahmindir.

Tarım kartlarında bankaya özel vade/ürün parametreleri gerekebilir. Tarım POS API yetkileri ve ilgili kart için gereken alanlar test hesabı/sağlayıcı ile teyit edilmeden canlıya geçilmemelidir.

Dönüş adresi `/api/payments/paratika/callback?state=...` şeklinde işlem başına rastgele oluşturulur. Gelen başarı bildirimi tek başına yeterli sayılmaz; sunucu QUERYTRANSACTION ile tutar, cari, para birimi, referans, banka işlem kimliği, tarih, taksit ve ödeme sistemini doğrular. Aynı işlem anahtarıyla ikinci kart gönderim adresi verilmez. Sonucu belirsiz işlem yeniden tahsilat başlatılmadan kontrol edilir.

## Sonuç kontrolü ve muhasebe

`GET /api/cron/paratika-reconcile` uç noktası `Authorization: Bearer <CRON_SECRET>` ile çağrılır. Zamanlayıcı bu değişiklikle kurulmadı. Uygun barındırma planında veya harici güvenli zamanlayıcıda her dakika çağrı önerilir; her çağrı en eski dört bekleyen işlemi kontrol eder. Ayrıca paneldeki kontrol düğmesi ve ödeme dönüşü sorgulama yapar. Tarayıcı kapanması durumunda otomatik tamamlanma için zamanlayıcı kurulmalıdır.

Üç günlük bloke süresi yalnız bilgi olarak gösterilir. Otomatik banka hesabına virman yapılmaz. Paraşüt'e yazma sırasında sonuç belirsizse otomatik tekrar denenmez; `Kontrol gerekli` kaydı muhasebe ile mutabakat gerektirir. Süreç yazma sırasında kesilirse `posting` kaydı da manuel kontrol edilmelidir. Banka iptal/iadesi bu ekran üzerinden yapılmaz. Tamamlanan Paratika kaydı manuel silme düğmesiyle silinemez.

## Yerel doğrulama

`node tests/paratika/check.cjs` tutar ve banka yanıtı doğrulamasını, mevcut Paraşüt tahsilat/ödeme yönlerini sahte servislerle kontrol eder. Gerçek banka veya Paraşüt isteği göndermez. Veritabanı kurulumu yerel geçici PostgreSQL üzerinde ayrıca test edildi.

Resmi kaynaklar: https://vpos.paratika.com.tr/paratika/api/v2/doc?language=tr ve https://www.paratika.com.tr/marka-kilavuzu/

## Onaylanan Paraşüt hesap eşlemesi

10013929 Tarım POS için mevcut Kart Çekimleri hesabının (`PARASUT_ACCOUNT_ID`) kullanılması kullanıcı tarafından onaylandı. Özel `PARATIKA_10013929_PARASUT_ACCOUNT_ID` yoksa yalnız bu hesapta mevcut hesaba kayıt atılır. 10013922 Normal POS için bu geri dönüş yoktur. Müşteri carisi her işlemde seçilen cari kimliğidir; Paraşüt hesabı cari seçiminden farklıdır.
