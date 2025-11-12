// import Timeline from '../src/timeline.js'; //lokalde test için
import Timeline from 'https://cdn.jsdelivr.net/gh/sergenaras/timeline-canvas@main/src/timeline.js'; // github üzerinden CDN kullanımı

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Timeline bileşenini başlat
    const timeline = new Timeline('myTimeline');

    // 2. Demo verisi tanımla
    const demoData = [
        { 
            date: new Date(2023, 0, 1), 
            title: "Yıl Başı 2023", 
            description: "Yeni bir yıl başladı." 
        },
        { 
            date: new Date(2023, 4, 19), 
            title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", 
            description: "19 Mayıs kutlamaları." 
        },
        { 
            date: new Date(2023, 9, 29), 
            title: "Cumhuriyet Bayramı", 
            description: "Türkiye Cumhuriyeti'nin 100. Yılı." 
        },
        { 
            date: new Date(), 
            title: "Bugün", 
            description: "Şu an." 
        },
        { 
            date: new Date(2024, 0, 1), 
            title: "Yıl Başı 2024", 
            description: "Yeni bir yıl daha." 
        }
    ];

    // 3. Veriyi bileşene yükle
    timeline.setData(demoData);

    // 4. Kontrol butonlarını bağla
    document.getElementById('zoomInBtn').onclick = () => timeline.zoomIn();
    document.getElementById('zoomOutBtn').onclick = () => timeline.zoomOut();
    document.getElementById('goToTodayBtn').onclick = () => timeline.goToToday();

    // 5. Bileşen olaylarını dinle
    const detailsPanel = document.getElementById('detailsPanel');
    
    timeline.on('eventClick', (event) => {
        console.log("Olay tıklandı:", event);
        
        // Demo detay panelini güncelle
        detailsPanel.innerHTML = `
            <h3>${event.title}</h3>
            <p>${event.date.toLocaleDateString()}</p>
            <p>${event.description || ''}</p>
        `;
        
        // Olaya tıklandığında ortala
        timeline.goToDate(event.date);
        
        // Tıklanan olayı bir sonraki zoom için odak yap
        timeline.setFocalEvent(event);
    });

    const zoomIndicator = document.getElementById('zoomIndicator');
    timeline.on('zoom', (zoomInfo) => {
        console.log("Zoom değişti:", zoomInfo);
        zoomIndicator.textContent = `${zoomInfo.levelId}x - ${zoomInfo.levelName}`;
        
        // Göster/Gizle animasyonu
        zoomIndicator.classList.add('active');
        setTimeout(() => { zoomIndicator.classList.remove('active'); }, 1500);
    });

    // 6. Pencere yeniden boyutlandığında bileşeni bilgilendir
    window.addEventListener('resize', () => {
        timeline.resize();
    });

});