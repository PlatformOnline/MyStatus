# MyStatus: Marketplace yayın yapılacaklar listesi

> Son güncelleme: 18 Kasım 2026. Bu dosya `.vsix` paketine girmez.

## Şu anki durum

| | |
|---|---|
| Repo | https://github.com/PlatformOnline/MyStatus (public, varsayılan branch: `development`) |
| Branch akışı | `feature/*`, `chore/*` → `development` (squash) → `test` (merge) → `main` (merge) → yayın + `v*` etiketi |
| Sürüm | `0.1.0` (package.json), publisher `PlatformOnline` |
| Paket testi | `vsce package` uyarısız çalışıyor: 9 dosya, 124 KB |
| Güvenlik | `npm audit`: 0 uyarı; açık Dependabot uyarısı yok |

Marketplace hazırlığının tamamı `development`'ta: README, CHANGELOG, LICENSE, ikon, publisher, oturum hatası düzeltmesi ve bağımlılık `overrides`'ı. `test` ve `main` henüz eski hallerinde, `development`'ın 5 commit gerisinde.

> Repo 18 Kasım 2026'da yeniden oluşturuldu. PR numaraları baştan başladı; eski commit mesajlarındaki `(#2)`–`(#11)` numaraları artık var olan PR'ları göstermez.

## Evde ortamı kurma

```bash
git clone https://github.com/PlatformOnline/MyStatus.git
cd MyStatus
npm ci
npm run compile
```

- **Node 22 veya üstü gerekli**, çünkü vsce v4 bunu istiyor.
- Repo public; herkes klonlayabilir. Push ve birleştirme yetkisi **`yasinersever`** hesabında.
- Denemek için VS Code'da **F5**'e basın. Test penceresi yalnızca bu extension ile açılır (`--disable-extensions`).
- Testler: `npm test`
- Commit atmadan önce `git config user.email` değerinin kişisel adresiniz olduğunu kontrol edin.

## Yapılacaklar

### 1. Publisher oluşturma (yalnızca siz yapabilirsiniz)
- [x] https://marketplace.visualstudio.com/manage adresinde bir publisher oluşturun ya da var olanı seçin. Publisher ID: **`PlatformOnline`**
- [ ] https://dev.azure.com adresinde bir **Personal Access Token (PAT)** oluşturun:
  - Organization: **All accessible organizations**
  - Scope: **Marketplace → Manage**
  - Token'ı kimseyle paylaşmayın; sohbete ya da repoya yazmayın.

### 2. Kodda kalan değişiklikler
- [x] `package.json` → `"publisher": "PlatformOnline"`
- [x] ~~**Private repo sorunu:** vsce, README'deki göreli bağlantıları (örneğin `[MIT](LICENSE)`) GitHub adreslerine çeviriyor. Repo private olduğu için Marketplace ziyaretçileri bu bağlantıları açamaz. Birini seçin:
  - Repoyu public yapın, **veya**
  - README'deki göreli bağlantıları kaldırın. `package.json`'daki `repository`, `bugs` ve `homepage` alanlarını da çıkarmayı ya da public bir adrese yönlendirmeyi düşünün.~~
  - Çözüldü: repo public yapıldı (18 Kasım 2026).
- [ ] **Ekran görüntüleri (önerilir):** sidebar (Profile, Followers, Following), hover kartı, Set Status adımları ve emoji seçici.
  - Görseller herkesin erişebileceği bir adreste olmalı. Repo public olduğu için repoya eklenen görseller Marketplace'te görünür.
- [ ] İsteğe bağlı: `displayName` ("MyStatus – GitHub Followers & Status") ve `LICENSE`'taki telif sahibi ("PlatformOnline") doğru mu, kontrol edin.

### 3. Birleştirme ve sürümleri ilerletme
- [x] Marketplace hazırlığını `development`'a **squash** ile birleştirin.
- [ ] `development` → `test` PR'ı açın ve **merge** ile birleştirin. Admin yetkisi gerekir: `gh pr merge <no> --merge --admin`
- [ ] Test edin: `npx vsce package` → oluşan `.vsix` dosyasını VS Code'da **Extensions → … → Install from VSIX** ile kurup deneyin.
- [ ] `test` → `main` PR'ı açın ve **merge** ile birleştirin (admin).

### 4. Yayınlama (`main` üzerinden)
```bash
git switch main && git pull
npx vsce login PlatformOnline    # PAT'i burada siz girersiniz
npx vsce publish
```
- [ ] Sürüm etiketini atın. **`v*` etiketleri bir kez atıldıktan sonra değiştirilemez ve silinemez**, bu yüzden yayın başarılı olduktan sonra atın:
  ```bash
  git tag v0.1.0 && git push origin v0.1.0
  ```
- [ ] Marketplace sayfasını kontrol edin: ikon, README, bağlantılar, kurulum.

## Bilinmesi gerekenler
- **`main` ve `test`:** Doğrudan push edilemez. PR açılmalı ve **admin bypass** ile birleştirilmeli.
- **`development`:** PR zorunlu, squash ile birleştirilir, admin gerekmez.
- **Renovate:** Bağımlılık PR'larını `development`'a açar. `@types/vscode` güncellemeleri kapalı; bu paket `engines.vscode` (^1.95.0) sürümünden yeni olamaz, yoksa `vsce package` hata verir. `@types/node` için ana sürüm güncellemeleri de kapalı.
- **TypeScript 7:** Renovate'in TypeScript 7 PR'ı `tsconfig.json`'a `"types": ["node", "mocha"]` eklenmeden geçmez. TS 7 `@types` paketlerini artık otomatik dahil etmiyor. Bu ayar TS 5.9'da da çalışıyor.
- **Bağımlılık `overrides`'ı:** `package.json`'daki `overrides` (mocha, glob, minimatch), `@vscode/test-cli`'nin kilitlediği eski ve açık içeren sürümleri zorla günceller. test-cli yeni bağımlılıklarla sürüm çıkarınca bu satırlar gözden geçirilmeli. Hepsi geliştirme bağımlılığı; hiçbiri `.vsix` paketine girmiyor.
