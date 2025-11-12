// import Timeline from '../src/timeline.js'; //lokalde test için
import Timeline from 'https://cdn.jsdelivr.net/gh/sergenaras/timeline-canvas@main/src/timeline.js'; // github üzerinden CDN kullanımı

const DATA_URL = 'https://cdn.jsdelivr.net/gh/sergenaras/timeline-canvas@main/demo/data.json';

async function initializeTimeline() {
    
    const timeline = new Timeline('myTimeline');

    let demoData = [];
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        demoData = await response.json();

        demoData = demoData.map(event => {
            if (event.date === "now") {
                event.date = new Date();
            }
            return event;
        });

    } catch (error) {
        console.error("Demo verisi yüklenemedi:", error);
        document.getElementById('detailsPanel').innerHTML = `<p style="color: red;">Demo verisi yüklenemedi. Lütfen konsolu kontrol edin.</p>`;
    }

    timeline.setData(demoData);

    document.getElementById('zoomInBtn').onclick = () => timeline.zoomIn();
    document.getElementById('zoomOutBtn').onclick = () => timeline.zoomOut();
    document.getElementById('goToTodayBtn').onclick = () => timeline.goToToday();

    const detailsPanel = document.getElementById('detailsPanel');
    
    timeline.on('eventClick', (event) => {
        console.log("Olay tıklandı:", event);
        
        detailsPanel.innerHTML = `
            <h3>${event.title}</h3>
            <p>${new Date(event.date).toLocaleDateString()}</p>
            <p>${event.description || ''}</p>
        `;
        
        timeline.goToDate(event.date);
        timeline.setFocalEvent(event);
    });

    const zoomIndicator = document.getElementById('zoomIndicator');
    timeline.on('zoom', (zoomInfo) => {
        console.log("Zoom değişti:", zoomInfo);
        zoomIndicator.textContent = `${zoomInfo.levelId}x - ${zoomInfo.levelName}`;
        
        zoomIndicator.classList.add('active');
        setTimeout(() => { zoomIndicator.classList.remove('active'); }, 1500);
    });

    window.addEventListener('resize', () => {
        timeline.resize();
    });
}

document.addEventListener("DOMContentLoaded", initializeTimeline);