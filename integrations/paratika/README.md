# Kart Çekimleri ve Paratika

Mevcut Kart Çekimleri formu Paraşüt cari hareketi kaydetmeye devam eder. Bu form karttan para çekmez. Ek Paratika bölümü yeni bir ödeme bağlantısı oluşturur; yalnız banka sorgusuyla doğrulanan canlı tahsilat aynı cari için Paraşüt'e ve mevcut Kart Çekimleri listesine kaydedilir. Mevcut çekimler için yeniden ödeme bağlantısı oluşturmayın.

## Hazırlık durumu

Kod hazır; gerçek tahsilat yapılmadı, veritabanı kurulumu ve canlı yayın uygulanmadı. Varsayılan olarak ödeme başlatma kapalıdır. Paratika API kullanıcı bilgileri olmadan çalışmaz.

1. Niba veritabanında `setup.sql` dosyasını bir kez uygulayın. Başka Supabase projesine uygulamayın. Mevcut manuel kayıtlar korunur.
2. Ortam ayarlarını güvenli yayın ayarlarına girin. Parola ve anahtarları koda veya sohbete yazmayın.
3. Test ortamında başarılı/başarısız ödeme, sekmenin kapanması, tekrarlanan dönüş ve Paraşüt bağlantı kesintisi senaryolarını kontrol edin. Test ödemeleri Paraşüt'e aktarılmaz.
4. Paratika hesabında barındırılan ödeme sayfasının 3D Secure ayarını ve dönüş adresini sağlayıcıyla doğrulayın. Uygulama kart bilgisi toplamaz.
5. Canlı geçişte ayrı onayla canlı modu ve iki etkinleştirme ayarını açın.

## Ortam ayarları

- `PARATIKA_MODE=test` (canlı için `live`)
- `PARATIKA_MERCHANT`: ilgili ortamın üye iş yeri numarası; canlı hesap için 10013929 bilgisi verildi, sağlayıcıyla teyit edilmeli.
- `PARATIKA_MERCHANT_USER`, `PARATIKA_MERCHANT_PASSWORD`: ilgili ortam API kullanıcısı.
- `PARATIKA_PUBLIC_ORIGIN=https://www.nibatarim.com`
- `PARATIKA_ENABLED=false`: testte hazırlık sonrası true.
- `PARATIKA_LIVE_ENABLED=false`: canlı ödeme için ayrıca true gerekir.
- `PARATIKA_PARASUT_ACCOUNT_ID`: Paraşüt'te Paratika bloke tahsilatlarını izleyecek hesabın kimliği. Canlı ödeme başlatmak için zorunlu. Mevcut manuel form `PARASUT_ACCOUNT_ID` kullanmayı sürdürür.
- Mevcut Paraşüt, Supabase ve yönetici izin ayarları korunur.
- `CRON_SECRET`: en az 32 karakter, güvenli zamanlayıcı çağrısı için.

Dönüş adresi `/api/payments/paratika/callback?state=...` şeklinde işlem başına rastgele oluşturulur. Gelen başarı bildirimi tek başına yeterli sayılmaz; sunucu QUERYTRANSACTION ile tutar, cari, para birimi, referans, banka işlem kimliği ve tarihini doğrular.

## Sonuç kontrolü ve muhasebe

`GET /api/cron/paratika-reconcile` uç noktası `Authorization: Bearer <CRON_SECRET>` ile çağrılır. Zamanlayıcı bu değişiklikle kurulmadı. Uygun barındırma planında veya harici güvenli zamanlayıcıda her dakika çağrı önerilir; her çağrı en eski dört bekleyen işlemi kontrol eder. Ayrıca paneldeki kontrol düğmesi ve ödeme dönüşü sorgulama yapar. Tarayıcı kapanması durumunda otomatik tamamlanma için zamanlayıcı kurulmalıdır.

Üç günlük bloke süresi yalnız bilgi olarak gösterilir. Otomatik banka hesabına virman yapılmaz. Paraşüt'e yazma sırasında sonuç belirsizse otomatik tekrar denenmez; `Kontrol gerekli` kaydı muhasebe ile mutabakat gerektirir. Süreç yazma sırasında kesilirse `posting` kaydı da manuel kontrol edilmelidir. Banka iptal/iadesi bu ekran üzerinden yapılmaz. Tamamlanan Paratika kaydı manuel silme düğmesiyle silinemez.

## Yerel doğrulama

`node tests/paratika/check.cjs` tutar ve banka yanıtı doğrulamasını, mevcut Paraşüt tahsilat/ödeme yönlerini sahte servislerle kontrol eder. Gerçek banka veya Paraşüt isteği göndermez. Veritabanı kurulumu yerel geçici PostgreSQL üzerinde ayrıca test edildi.

Resmi kaynaklar: https://vpos.paratika.com.tr/paratika/api/v2/doc?language=tr ve https://www.paratika.com.tr/marka-kilavuzu/
