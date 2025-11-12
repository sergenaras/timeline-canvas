class Timeline {

    // Varsayılan yapılandırma. Bu, config.js ve i18n.js'nin yerini alır.
    // 'options' parametresi ile ezilebilir.
    DEFAULT_CONFIG = {
        WHEEL_ZOOM_TICKS: 4,
    
        // config.js -> ZOOM_LEVELS
        ZOOM_LEVELS: [
            { id: 1, pixelsPerYear: 100, showDays: false, showMonths: false }, // x1 Yıl
            { id: 2, pixelsPerYear: 1200, showDays: false, showMonths: true }, // x2 Ay
            { id: 3, pixelsPerYear: 365 * 50, showDays: true, showMonths: true }, // x3 Gün
            { id: 4, pixelsPerYear: 365 * 24 * 60, showDays: true, showMonths: true, showHours: true } // x4 Saat
        ],
        
        // config.js -> COLORS
        COLORS: {
            background: '#FFFFFF',
            text: '#212121',
            textLight: '#757575',
            textVeryLight: '#BDBDBD',
            
            ruler: '#E0E0E0',
            todayMarker: '#E53935',
            hoverMarker: '#1E88E5',
            
            yearLine: '#BDBDBD',
            yearLineThick: '#757575',
            monthLine: '#EEEEEE',
            dayLine: '#F5F5F5',
            
            eventBar: '#757575',
            eventBarHover: '#1E88E5'
        },

        // config.js -> LAYOUT
        LAYOUT: {
            rulerYOffset: 0,
            eventBarBaseY: -60,
            markerLineLength: 40,
            monthLabelOffset: 25
        },
        
        // config.js -> Event Display
        EVENT_BAR_HEIGHT: 8,
        EVENT_BAR_SPACING: 4,
        EVENT_MAX_STACK: 5,
        
        // i18n.js -> en (Varsayılan dil olarak İngilizce)
        translations: {
            zoomLevel1: 'Years',
            zoomLevel2: 'Months',
            zoomLevel3: 'Days',
            zoomLevel4: 'Hours',
            months: {
                full: [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ],
                short: [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                ]
            },
            now: 'Now',
            today: 'Today' // Orijinalde bu yoktu ama 'today' için faydalı
        }
    };

    /**
     * @param {string} canvasId Çizim yapılacak canvas öğesinin ID'si.
     * @param {object} options Varsayılan DEFAULT_CONFIG'i ezmek için yapılandırma objesi.
     */
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("Timeline: Canvas öğesi bulunamadı: " + canvasId);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;

        // Yapılandırmayı birleştir
        this.config = {
            ...this.DEFAULT_CONFIG,
            ...options,
            COLORS: { ...this.DEFAULT_CONFIG.COLORS, ...options.COLORS },
            LAYOUT: { ...this.DEFAULT_CONFIG.LAYOUT, ...options.LAYOUT },
            translations: { ...this.DEFAULT_CONFIG.translations, ...options.translations }
        };
        
        // State
        this.events = [];
        this.zoomLevel = 0;
        this.offsetX = 0;
        this.targetOffsetX = 0; 
        
        // Yavaş zoom için tekerlek sayacı
        this.wheelZoomCounter = 0;
        // -----------
        
        // Touch/Mouse state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // Hover/Select state
        this.hoveredEvent = null;
        this.focalEvent = null; // window.currentSelectedEvent'in yerini aldı
        this.hoverX = -1; 
        
        this.today = new Date();
        
        // Basit Olay Yayınlayıcı (Event Emitter)
        this.callbacks = {
            eventClick: [],
            zoom: []
        };
        
        // Initialize
        this.resize();
        this.setupEventListeners();
        
        this.animate(); 
    }
    
    // --- Public API ---

    /**
     * Bileşene olay verisini yükler.
     * @param {Array<object>} events Olay objeleri dizisi. 
     * Her obje { date: Date, title: string, ... } içermelidir.
     */
    setData(eventsData) {
        this.events = (eventsData || []).map(event => ({
            ...event,
            date: event.date ? new Date(event.date) : new Date(event.year, 0, 1),
        }));
        
        this.events.sort((a, b) => a.date - b.date);
        
        this.calculateEventStacks();
        this.render(); // Veri gelince yeniden çiz
    }

    /**
     * Belirli bir olayı odak noktası olarak ayarlar.
     * Bu olay, bir sonraki zoomIn/zoomOut işlemi için merkez olarak kullanılır.
     * @param {object} event Olay objesi
     */
    setFocalEvent(event) {
        this.focalEvent = event;
    }

    /**
     * Odaklanmış olayı temizler. Zoom, ekranın merkezini kullanır.
     */
    clearFocalEvent() {
        this.focalEvent = null;
    }

    /**
     * Olay dinleyicisi ekler.
     * Desteklenen olaylar: 'eventClick', 'zoom'
     * @param {string} eventName 
     * @param {function} callback 
     */
    on(eventName, callback) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].push(callback);
        }
    }

    /**
     * Canvas'ı yeniden boyutlandırır. Kapsayıcı öğenin boyutuna göre ayarlanır.
     * Bu fonksiyon, pencere yeniden boyutlandırıldığında dışarıdan çağrılmalıdır.
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.render(); // Boyut değişince yeniden çiz
    }

    /**
     * Zoom seviyesini artırır.
     * @param {Event} e (Opsiyonel) Fare olayı, odak noktasını belirlemek için.
     */
    zoomIn(e = null) {
        if (this.zoomLevel >= this.config.ZOOM_LEVELS.length - 1) return;
        
        const focalX = this.getFocalX(e);
        const currentDays = this.xToDays(focalX, this.zoomLevel);
        
        this.zoomLevel++;
        
        const newOffsetX = this.daysToOffsetX(currentDays, this.zoomLevel, focalX);
        this.targetOffsetX = newOffsetX;
        this.offsetX = newOffsetX; // "Dönme" sorununu çözmek için anında geçiş
        
        this.emit('zoom', { 
            levelId: this.config.ZOOM_LEVELS[this.zoomLevel].id,
            levelName: this.t('zoomLevel' + this.config.ZOOM_LEVELS[this.zoomLevel].id)
        });
    }
    
    /**
     * Zoom seviyesini azaltır.
     * @param {Event} e (Opsiyonel) Fare olayı, odak noktasını belirlemek için.
     */
    zoomOut(e = null) {
        if (this.zoomLevel <= 0) return;

        const focalX = this.getFocalX(e);
        const currentDays = this.xToDays(focalX, this.zoomLevel);

        this.zoomLevel--;

        const newOffsetX = this.daysToOffsetX(currentDays, this.zoomLevel, focalX);
        this.targetOffsetX = newOffsetX;
        this.offsetX = newOffsetX; // "Dönme" sorununu çözmek için anında geçiş
        
        this.emit('zoom', { 
            levelId: this.config.ZOOM_LEVELS[this.zoomLevel].id,
            levelName: this.t('zoomLevel' + this.config.ZOOM_LEVELS[this.zoomLevel].id)
        });
    }

    /**
     * Zaman çizelgesini bugüne ortalar.
     */
    goToToday() {
        this.targetOffsetX = 0;
    }
    
    /**
     * Zaman çizelgesini belirli bir tarihe kaydırır.
     * @param {Date | string} selectedDate Gidilecek tarih.
     */
    goToDate(selectedDate) {
        const date = new Date(selectedDate);
        const diffDays = this.daysFromToday(date);
        const level = this.config.ZOOM_LEVELS[this.zoomLevel];
        const pixelsPerDay = level.pixelsPerYear / 365;
        this.targetOffsetX = -(diffDays * pixelsPerDay);
    }
    
    // --- Dahili Fonksiyonlar ---
    
    /**
     * Basit çeviri fonksiyonu.
     * @param {string} key 'now', 'zoomLevel1' veya 'months.full' gibi.
     */
    t(key) {
        const keys = key.split('.');
        let value = this.config.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Bulamazsa anahtarı döndür
            }
        }
        return value || key;
    }

    /**
     * Olay yayınlayıcı (emitter)
     */
    emit(eventName, data) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * Zoom için odaklanacak X koordinatını belirler.
     * Öncelik sırası:
     * 1. Dışarıdan ayarlanan 'focalEvent'
     * 2. Fare olayının (e) konumu
     * 3. Ekranın merkezi (fallback)
     */
    getFocalX(e) {
        // 1. Odaklanmış Olay
        if (this.focalEvent && 
            this.focalEvent._renderX !== undefined &&
            this.focalEvent._renderX >= 0 && 
            this.focalEvent._renderX <= this.width) 
        {
            return this.focalEvent._renderX;
        }
        
        // 2. Fare Olayı Konumu
        if (e && e.clientX) { 
            const rect = this.canvas.getBoundingClientRect();
            return e.clientX - rect.left;
        }
        
        // 3. Fallback: Merkez
        return this.centerX; 
    }
    
    // Olay (event) yığınlarını hesapla
    calculateEventStacks() {
        const dayGroups = {};
        
        this.events.forEach(event => {
            const dayKey = this.getDateKey(event.date);
            if (!dayGroups[dayKey]) {
                dayGroups[dayKey] = [];
            }
            dayGroups[dayKey].push(event);
        });
        
        Object.values(dayGroups).forEach(group => {
            group.forEach((event, index) => {
                event.stackLevel = Math.min(index, this.config.EVENT_MAX_STACK - 1);
            });
        });
    }
    
    getDateKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }
    
    // Animasyon döngüsü
    animate() {
        const dx = this.targetOffsetX - this.offsetX;
        
        if (Math.abs(dx) > 0.1) {
            this.offsetX += dx * 0.02; // Pürüzsüz kaydırma
        } else {
            this.offsetX = this.targetOffsetX;
        }
        
        this.render();
        requestAnimationFrame(this.animate.bind(this));
    }
    
    // Ana çizim fonksiyonu
    render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const level = this.config.ZOOM_LEVELS[this.zoomLevel];
        const baselineY = this.centerY + (this.config.LAYOUT.rulerYOffset || 0);
        
        ctx.fillStyle = this.config.COLORS.background;
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.strokeStyle = this.config.COLORS.ruler;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, baselineY);
        ctx.lineTo(this.width, baselineY);
        ctx.stroke();
        
        if (level.showHours) {
            this.renderHoursView(ctx, level, baselineY);
        } else if (level.showDays) {
            this.renderDaysView(ctx, level, baselineY);
        } else if (level.showMonths) {
            this.renderMonthsView(ctx, level, baselineY);
        } else {
            this.renderYearsView(ctx, level, baselineY);
        }
        
        this.renderTodayMarker(ctx, level, baselineY);
        this.renderEvents(ctx, level, baselineY);
        this.renderHoverMarker(ctx, baselineY);
    }
    
    daysFromToday(date) {
        const diffMs = date.getTime() - this.today.getTime();
        return diffMs / (1000 * 60 * 60 * 24);
    }

    // Yıl görünümü
    renderYearsView(ctx, level, baselineY) {
        const pixelsPerDay = level.pixelsPerYear / 365;
        const startDays = this.xToDays(-this.width / 2, this.zoomLevel);
        const endDays = this.xToDays(this.width * 1.5, this.zoomLevel);
        const startDate = new Date(this.today.getTime() + startDays * 1000 * 60 * 60 * 24);
        const endDate = new Date(this.today.getTime() + endDays * 1000 * 60 * 60 * 24);
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        
        for (let year = startYear; year <= endYear; year++) {
            const yearStartDate = new Date(year, 0, 1);
            const diffDays = this.daysFromToday(yearStartDate);
            const x = this.centerX + (diffDays * pixelsPerDay) + this.offsetX;
            
            ctx.strokeStyle = this.config.COLORS.yearLine;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, baselineY - 15);
            ctx.lineTo(x, baselineY + 15);
            ctx.stroke();
            
            ctx.fillStyle = this.config.COLORS.text;
            ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(year.toString(), x, baselineY + 35);
        }
    }
    
    // Ay görünümü
    renderMonthsView(ctx, level, baselineY) {
        const pixelsPerDay = level.pixelsPerYear / 365;
        const monthLabelOffset = this.config.LAYOUT.monthLabelOffset;
        const startDays = this.xToDays(-this.width / 2, this.zoomLevel);
        const endDays = this.xToDays(this.width * 1.5, this.zoomLevel);
        const startDate = new Date(this.today.getTime() + startDays * 1000 * 60 * 60 * 24);
        const endDate = new Date(this.today.getTime() + endDays * 1000 * 60 * 60 * 24);
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const renderedMonthLabels = [];

        for (let year = startYear; year <= endYear; year++) {
            const yearStartDate = new Date(year, 0, 1);
            const yearDiffDays = this.daysFromToday(yearStartDate);
            const yearX = this.centerX + (yearDiffDays * pixelsPerDay) + this.offsetX;
            
            ctx.strokeStyle = this.config.COLORS.yearLineThick;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(yearX, baselineY - 20);
            ctx.lineTo(yearX, baselineY + 20);
            ctx.stroke();
            
            ctx.fillStyle = this.config.COLORS.text;
            ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(year.toString(), yearX, baselineY + 40);
            
            for (let month = 0; month < 12; month++) {
                const monthStartDate = new Date(year, month, 1);
                const monthDiffDays = this.daysFromToday(monthStartDate);
                const monthX = this.centerX + (monthDiffDays * pixelsPerDay) + this.offsetX;
                
                if (month > 0) {
                    ctx.strokeStyle = this.config.COLORS.monthLine;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(monthX, baselineY - 12);
                    ctx.lineTo(monthX, baselineY + 12);
                    ctx.stroke();
                }
                
                // this.t() kullanımı
                const monthText = this.t('months.full')[month];
                ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
                const textMetrics = ctx.measureText(monthText);
                const textWidth = textMetrics.width;
                const textHeight = 10; 
                const labelRect = { x: monthX - textHeight, y: baselineY - monthLabelOffset - textWidth, width: textHeight, height: textWidth };

                let canRender = true;
                for (const existingLabel of renderedMonthLabels) {
                    if (labelRect.x < existingLabel.x + existingLabel.width) { 
                        canRender = false;
                        break;
                    }
                }

                if (canRender) {
                    ctx.save();
                    ctx.translate(monthX, baselineY - monthLabelOffset);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = this.config.COLORS.textLight;
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'left'; 
                    ctx.fillText(monthText, 0, 0);
                    ctx.restore();
                    renderedMonthLabels.push(labelRect);
                }
            }
        }
    }
    
    // Gün görünümü
    renderDaysView(ctx, level, baselineY) {
        const pixelsPerDay = level.pixelsPerYear / 365;
        const monthLabelOffset = this.config.LAYOUT.monthLabelOffset;
        const startDays = this.xToDays(-this.width / 2, this.zoomLevel);
        const endDays = this.xToDays(this.width * 1.5, this.zoomLevel);
        const startDate = new Date(this.today.getTime() + startDays * 1000 * 60 * 60 * 24);
        const endDate = new Date(this.today.getTime() + endDays * 1000 * 60 * 60 * 24);
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        const renderedMonthLabels = [];

        for (let year = startYear; year <= endYear; year++) {
            for (let month = 0; month < 12; month++) {
                const monthStart = new Date(year, month, 1);
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const monthDiffDays = this.daysFromToday(monthStart);
                const monthX = this.centerX + (monthDiffDays * pixelsPerDay) + this.offsetX;

                if (monthX < -this.width / 2 || monthX > this.width * 1.5) {
                    continue;
                }

                ctx.strokeStyle = this.config.COLORS.yearLineThick;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(monthX, baselineY - 18);
                ctx.lineTo(monthX, baselineY + 18);
                ctx.stroke();
                
                if (month === 0) {
                    ctx.fillStyle = this.config.COLORS.text;
                    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(year.toString(), monthX, baselineY + 40);
                }
                
                // this.t() kullanımı
                const monthText = this.t('months.full')[month];
                ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
                const textMetrics = ctx.measureText(monthText);
                const textWidth = textMetrics.width;
                const textHeight = 11; 
                const labelRect = { x: monthX - textHeight, y: baselineY - monthLabelOffset - textWidth, width: textHeight, height: textWidth };

                let canRender = true;
                for (const existingLabel of renderedMonthLabels) {
                     if (labelRect.x < existingLabel.x + existingLabel.width) {
                        canRender = false;
                        break;
                    }
                }
                
                if (canRender) {
                    ctx.save();
                    ctx.translate(monthX, baselineY - monthLabelOffset);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = this.config.COLORS.text;
                    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'left'; 
                    ctx.fillText(monthText, 0, 0);
                    ctx.restore();
                    renderedMonthLabels.push(labelRect);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const dayDiffDays = this.daysFromToday(date);
                    const dayX = this.centerX + (dayDiffDays * pixelsPerDay) + this.offsetX;
                    
                    if (day > 1) {
                        if (dayX < 0 || dayX > this.width) continue; 
                        ctx.strokeStyle = this.config.COLORS.dayLine;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(dayX, baselineY - 8);
                        ctx.lineTo(dayX, baselineY + 8);
                        ctx.stroke();
                    }
                    
                    if (dayX < 0 || dayX > this.width) continue; 
                    
                    ctx.fillStyle = this.config.COLORS.textVeryLight;
                    ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(day.toString(), dayX, baselineY - 15);
                }
            }
        }
    }

    // Saat görünümü
    renderHoursView(ctx, level, baselineY) {
        const pixelsPerDay = level.pixelsPerYear / 365;
        const pixelsPerHour = pixelsPerDay / 24;
        
        const startDays = this.xToDays(-this.width / 2, this.zoomLevel);
        const endDays = this.xToDays(this.width * 1.5, this.zoomLevel);
        
        const startDate = new Date(this.today.getTime() + startDays * 1000 * 60 * 60 * 24);
        const endDate = new Date(this.today.getTime() + endDays * 1000 * 60 * 60 * 24);
        
        const visibleDays = endDays - startDays;
        
        if (visibleDays > 3) {
             this.renderDaysView(ctx, level, baselineY);
             return;
        }
        
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        const startDay = startDate.getDate();
        
        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth();
        const endDay = endDate.getDate();

        let currentDay = new Date(startYear, startMonth, startDay);

        while (currentDay <= endDate) {
            const dayDiffDays = this.daysFromToday(currentDay);
            const dayX = this.centerX + (dayDiffDays * pixelsPerDay) + this.offsetX;

            if (dayX < -this.width / 2 || dayX > this.width * 1.5) {
                currentDay.setDate(currentDay.getDate() + 1); 
                continue;
            }

            ctx.strokeStyle = this.config.COLORS.yearLineThick;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dayX, baselineY - 20);
            ctx.lineTo(dayX, baselineY + 20);
            ctx.stroke();

            // this.t() kullanımı
            const dayText = `${currentDay.getDate()} ${this.t('months.full')[currentDay.getMonth()]} ${currentDay.getFullYear()}`;
            ctx.fillStyle = this.config.COLORS.text;
            ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dayText, dayX, baselineY + 40);

            for (let hour = 0; hour < 24; hour++) {
                const hourDate = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), hour);
                const hourDiffDays = this.daysFromToday(hourDate);
                const hourX = this.centerX + (hourDiffDays * pixelsPerDay) + this.offsetX;

                if (hourX < 0 || hourX > this.width) continue; 
                
                if (hour > 0) {
                    ctx.strokeStyle = this.config.COLORS.dayLine; 
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(hourX, baselineY - 12);
                    ctx.lineTo(hourX, baselineY + 12);
                    ctx.stroke();
                    
                    ctx.fillStyle = this.config.COLORS.textLight;
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${hour.toString().padStart(2, '0')}:00`, hourX, baselineY - 18);
                }
            }
            
            currentDay.setDate(currentDay.getDate() + 1); 
        }
    }
    
    // "Bugün" (Now) işaretçisi
    renderTodayMarker(ctx, level, baselineY) {
        const diffDays = this.daysFromToday(this.today);
        const pixelsPerDay = level.pixelsPerYear / 365;
        const x = this.centerX + (diffDays * pixelsPerDay) + this.offsetX; 
        
        const markerLength = this.config.LAYOUT.markerLineLength / 2;

        ctx.strokeStyle = this.config.COLORS.todayMarker;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, baselineY - markerLength);
        ctx.lineTo(x, baselineY + markerLength);
        ctx.stroke();
        
        ctx.fillStyle = this.config.COLORS.todayMarker;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        // this.t() kullanımı
        ctx.fillText(this.t('now').toUpperCase(), x, baselineY - this.config.LAYOUT.monthLabelOffset - 10);
    }
    
    // Olay (event) çubukları
    renderEvents(ctx, level, baselineY) {
        const pixelsPerDay = level.pixelsPerYear / 365;

        this.events.forEach(event => {
            const eventDate = event.date;
            const diffDays = this.daysFromToday(eventDate);
            const x = this.centerX + (diffDays * pixelsPerDay) + this.offsetX;
            
            if (x < -50 || x > this.width + 50) return;
            
            const barHeight = this.config.EVENT_BAR_HEIGHT;
            const barSpacing = this.config.EVENT_BAR_SPACING;
            const yOffset = (event.stackLevel || 0) * (barHeight + barSpacing);
            const y = baselineY + this.config.LAYOUT.eventBarBaseY - yOffset;
            const barWidth = 3;
            
            const isHovered = this.hoveredEvent === event;
            ctx.fillStyle = isHovered ? this.config.COLORS.eventBarHover : this.config.COLORS.eventBar;
            
            ctx.fillRect(x - barWidth/2, y - barHeight, barWidth, barHeight);
            
            // Olayın pozisyonunu daha sonra tıklama/hover tespiti için sakla
            event._renderX = x;
            event._renderY = y;
            event._renderWidth = barWidth;
            event._renderHeight = barHeight;
        });
    }

    // Fare imleci (hover) çizgisi
    renderHoverMarker(ctx, baselineY) {
        if (this.hoverX === -1 || this.isDragging) return; 
        const markerLength = this.config.LAYOUT.markerLineLength / 2; 
        ctx.strokeStyle = this.config.COLORS.hoverMarker;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.hoverX, baselineY - markerLength);
        ctx.lineTo(this.hoverX, baselineY + markerLength);
        ctx.stroke();
    }
    
    // --- Olay Dinleyicileri (Event Listeners) ---
    
    setupEventListeners() {
        // Global 'resize' dinleyicisi kaldırıldı.
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        
        // Dokunmatik desteği
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onMouseEnd(e));
    }
    
    onMouseDown(e) {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.canvas.classList.add('grabbing');
        this.targetOffsetX = this.offsetX; 
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.hoverX = x;
        
        if (this.isDragging) {
            const dx = e.clientX - this.lastX;
            this.targetOffsetX += dx; 
            this.lastX = e.clientX;
        } else {
            this.checkHover(x, y);
        }
    }
    
    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.classList.remove('grabbing');
    }
    
    onMouseLeave() {
        this.isDragging = false;
        this.canvas.classList.remove('grabbing');
        this.hoverX = -1;
        this.hoveredEvent = null;
    }
    
    onWheel(e) {
        if (e.shiftKey) {
            e.preventDefault(); 
            this.targetOffsetX -= e.deltaY;
        } 
        else {
            // --- GÜNCELLENDİ: Yavaş Zoom Mantığı ---
            e.preventDefault();
            this.wheelZoomCounter++;

            if (this.wheelZoomCounter >= this.config.WHEEL_ZOOM_TICKS) {
                if (e.deltaY < 0) {
                    this.zoomIn(e);
                } else if (e.deltaY > 0) {
                    this.zoomOut(e);
                }
                this.wheelZoomCounter = 0; // Sayacı sıfırla
            }
            // --- Bitiş: Yavaş Zoom ---
        }
    }
    
    onClick(e) {
        // Kaydırma bittikten sonra tıklamayı işle
        if (Math.abs(this.targetOffsetX - this.offsetX) > 2) return; 

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedEvent = this.getEventAtPosition(x, y);
        if (clickedEvent) {
            // Global fonksiyonu çağırmak yerine olay yayınla (emit)
            this.emit('eventClick', clickedEvent);
        }
    }
    
    onTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastX = e.touches[0].clientX;
            this.lastY = e.touches[0].clientY;
            this.targetOffsetX = this.offsetX;
            
        } else if (e.touches.length === 2) {
            // Pinch-zoom için başlangıç mesafesi (gelecekte eklenebilir)
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && this.isDragging) {
            const dx = e.touches[0].clientX - this.lastX;
            this.targetOffsetX += dx;
            this.lastX = e.touches[0].clientX;
        } else if (e.touches.length === 2) {
            // Pinch-zoom mantığı buraya eklenebilir
        }
    }
    
    onMouseEnd(e) { // touchend
        this.isDragging = false;
    }
    
    checkHover(x, y) {
        const hoveredEvent = this.getEventAtPosition(x, y);
        
        if (hoveredEvent !== this.hoveredEvent) {
            this.hoveredEvent = hoveredEvent;
            // Hover olayı da yayınlanabilir
            // this.emit('eventHover', hoveredEvent);
        }
    }
    
    getEventAtPosition(x, y) {
        const baselineY = this.centerY + (this.config.LAYOUT.rulerYOffset || 0);

        // Olayları tersten kontrol et (üsttekiler önce seçilsin)
        for (const event of [...this.events].reverse()) {
            if (event._renderX === undefined) continue;
            
            const barHeight = this.config.EVENT_BAR_HEIGHT;
            const barSpacing = this.config.EVENT_BAR_SPACING;
            const yOffset = (event.stackLevel || 0) * (barHeight + barSpacing);
            const eventBaseY = baselineY + this.config.LAYOUT.eventBarBaseY - yOffset;

            // Tıklama alanını biraz genişlet (hitbox)
            const hitMarginX = 10;
            const hitMarginY = 10;
            
            if (x >= event._renderX - hitMarginX &&
                x <= event._renderX + hitMarginX &&
                y >= eventBaseY - barHeight - hitMarginY && 
                y <= eventBaseY + hitMarginY) {             
                return event;
            }
        }
        return null;
    }

    // --- Koordinat Dönüştürme ---

    xToDays(x, zoomLevel) {
        const level = this.config.ZOOM_LEVELS[zoomLevel];
        const pixelsPerDay = level.pixelsPerYear / 365;
        const screenOffset = x - this.centerX - this.offsetX;
        const diffDays = screenOffset / pixelsPerDay;
        return diffDays;
    }

    daysToOffsetX(diffDays, zoomLevel, targetX) {
        const level = this.config.ZOOM_LEVELS[zoomLevel];
        const pixelsPerDay = level.pixelsPerYear / 365;
        const screenOffset = diffDays * pixelsPerDay;
        const newOffsetX = targetX - this.centerX - screenOffset;
        return newOffsetX;
    }
}

export default Timeline;