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
- [ ] **Trusted Publishing kuralı oluşturun (PAT gerekmez).** https://marketplace.visualstudio.com/manage adresinde `PlatformOnline` publisher'ını açın, **Trusted Publishing → Create**'e tıklayın ve alanları şöyle doldurun:

  | Alan | Değer |
  |---|---|
  | Policy name | `Release workflow` |
  | Repository owner | `PlatformOnline` |
  | Repository | `MyStatus` |
  | Workflow | `publish.yml` |
  | Environment | `marketplace` |

  Değerler birebir aynı olmalı. Workflow alanına yalnızca dosya adı yazılır, `.github/workflows/` yolu yazılmaz.
- [ ] GitHub'da `marketplace` ortamını (environment) oluşturun: **Settings → Environments → New environment**. Ayarlar:
  - **Deployment branches:** yalnızca `main`.
  - İsteğe bağlı: **Required reviewers** olarak kendinizi ekleyin. Böylece her yayın sizin onayınızı bekler.

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

### 4. Yayınlama (`main` üzerinden, GitHub Actions ile)
- [ ] **Publish to Marketplace** iş akışını `main` üzerinde elle başlatın. **Actions → Publish to Marketplace → Run workflow** yolunu kullanın ya da terminalden şunu çalıştırın:
  ```bash
  gh workflow run publish.yml --ref main
  ```
  İş akışı şu adımları sırayla yapar:
  1. `package.json`'daki sürüm için `v*` etiketi zaten varsa durur.
  2. Tip kontrolü, testler ve `vsce package` adımlarını çalıştırır.
  3. Test edilen `.vsix` dosyasını `vsce publish --oidc` ile yayınlar.
  4. Yayın başarılı olunca `v<sürüm>` etiketini ve `.vsix` dosyasını içeren bir GitHub Release oluşturur. **`v*` etiketleri bir kez atıldıktan sonra değiştirilemez ve silinemez**; bu yüzden etiket yalnızca yayından sonra atılır.
- [ ] Marketplace sayfasını kontrol edin: ikon, README, bağlantılar, kurulum.

**Yedek yol: elle yükleme.** Trusted Publishing ilk sürümde çalışmazsa şunu yapın:
1. İş akışının oluşturduğu `vsix` artifact'ını indirin ya da yerelde `npx vsce package` çalıştırın.
2. Dosyayı https://marketplace.visualstudio.com/manage adresinde `PlatformOnline` → **New extension → Visual Studio Code** ile yükleyin.
3. Ardından etiketi elle atın:
   ```bash
   git tag v0.1.0 origin/main && git push origin v0.1.0
   ```

Sonraki sürümler için `package.json` ve `CHANGELOG.md`'de sürümü yükseltin, değişiklikleri `main`'e taşıyın ve iş akışını tekrar çalıştırın.

## Bilinmesi gerekenler
- **`main` ve `test`:** Doğrudan push edilemez. PR açılmalı ve **admin bypass** ile birleştirilmeli.
- **`development`:** PR zorunlu, squash ile birleştirilir, admin gerekmez.
- **Renovate:** Bağımlılık PR'larını `development`'a açar. `@types/vscode` güncellemeleri kapalı; bu paket `engines.vscode` (^1.95.0) sürümünden yeni olamaz, yoksa `vsce package` hata verir. `@types/node` için ana sürüm güncellemeleri de kapalı.
- **PAT kullanılmıyor:** Azure DevOps'taki global PAT'ler 1 Aralık 2026'da kaldırılıyor. Bu yüzden yayın, saklanan bir token yerine GitHub OIDC ile yapılıyor; repoda saklanan bir secret yok. Marketplace'in verdiği kimlik bilgisi 15 dakika geçerli ve yalnızca bu iş akışı ile `marketplace` ortamı için çalışıyor.
- **TypeScript 7:** Proje TypeScript 7 kullanıyor. TS 7 `@types` paketlerini artık otomatik dahil etmediği için `tsconfig.json`'daki `"types": ["node", "mocha"]` satırı gerekli.
- **Bağımlılık `overrides`'ı:** `package.json`'daki `overrides` (mocha, glob, minimatch), `@vscode/test-cli`'nin kilitlediği eski ve açık içeren sürümleri zorla günceller. test-cli yeni bağımlılıklarla sürüm çıkarınca bu satırlar gözden geçirilmeli. Hepsi geliştirme bağımlılığı; hiçbiri `.vsix` paketine girmiyor.
