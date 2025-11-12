# Timeline Canvas

Bu proje, HTML Canvas kullanarak yüksek performanslı, zoom yapılabilir ve kaydırılabilir bir zaman çizelgesi bileşenidir. Orijinal "Hafıza Cetveli" projesinden bağımsız bir bileşen olarak yeniden düzenlenmiştir.

## 🚀 Canlı Demo

Bu kütüphanenin canlı demosunu GitHub Pages üzerinde görüntüleyebilirsiniz.

**[Canlı Demo Linki](https://sergenaras.github.io/timeline-canvas/)**
*(Bu link, projeyi `timeline-canvas` adıyla GitHub'a yükleyip `demo` klasörünü GitHub Pages kaynağı olarak ayarladığınızda çalışacaktır.)*

## ⚙️ Projenize Nasıl Eklersiniz (`hafiza` vb.)

Bu kütüphaneyi herhangi bir web projesine (Hafıza Cetveli projesi dahil) eklemenin en kolay yolu CDN (jsDelivr) kullanmaktır.

### Yöntem 1: CDN (jsDelivr) ile Kullanım (Önerilen)

Bu yöntem, `npm` kurulumu gerektirmez ve projenizi GitHub'a yüklediğiniz anda çalışır.

1.  `timeline-canvas` projenizi GitHub'a yükleyin.
2.  `hafiza` projenizdeki `index.html` dosyanıza bir `<canvas>` elemanı ekleyin.
3.  `hafiza` projenizin JavaScript dosyasına `import` satırını ekleyin.

#### Örnek `index.html` (Hafıza Projesi)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Hafıza Cetveli</title>
    <canvas id="timeline-container"></canvas>

    <script src="hafiza-app.js" type="module"></script>
</head>
<body>
    </body>
</html>