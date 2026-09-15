// --- State Management ---
let rawAttendant = []; let rawHourly = []; let rawProduct = [];
let filteredHourlyData = []; 

let employeeMapping = {
    "1": "เฟิร์น", "2": "ตุ้ย (แคช)", "3": "กี้ (ช่าง)", "4": "เหรียญ (แคช)", "5": "แต้ม", 
    "6": "ติ๋ว", "7": "นุช", "8": "เจ (ช่าง)", "9": "แช่ง", "10": "หนึ่ง (แคช)",
    "11": "ป่อง", "12": "ติ๋ม (แคช)", "13": "โอ (ช่าง)", "14": "น้อย", 
    "15": "อาร์ท", "16": "สุรเศรษฐ์"
};
let charts = { emp: null, hr: null, veh: null };
let siteName = "ไม่ระบุสาขา";
let activeEmpFilter = null; 

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    let bgColor = type === 'error' ? 'bg-red-500' : (type === 'success' ? 'bg-green-500' : 'bg-blue-500');
    toast.className = `${bgColor} text-white px-6 py-3 rounded shadow-lg font-medium toast flex items-center gap-2 min-w-[250px]`;
    toast.innerHTML = type === 'error' ? `⚠️ ${message}` : `✅ ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// 🌟 ระบบโหมดกลางคืน
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const htmlEl = document.documentElement;
    if (localStorage.getItem('dashboard_theme') === 'dark') {
        htmlEl.classList.add('dark');
        if(themeBtn) themeBtn.innerText = '☀️';
        updateChartThemeColors(true);
    } else { updateChartThemeColors(false); }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            htmlEl.classList.toggle('dark');
            let isDark = htmlEl.classList.contains('dark');
            localStorage.setItem('dashboard_theme', isDark ? 'dark' : 'light');
            themeBtn.innerText = isDark ? '☀️' : '🌙';
            updateChartThemeColors(isDark);
            if(charts.emp) charts.emp.update();
            if(charts.veh) charts.veh.update();
            if(charts.hr) charts.hr.update();
        });
    }
}

function updateChartThemeColors(isDark) {
    Chart.defaults.color = isDark ? '#9ca3af' : '#6b7280'; 
    Chart.defaults.scale.grid.color = isDark ? '#374151' : '#e5e7eb'; 
    Chart.defaults.scale.grid.borderColor = isDark ? '#374151' : '#e5e7eb';
}

// --- UI Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); 
    const empContainer = document.getElementById('empFormContainer');
    const compEmpSelect = document.getElementById('compEmpSelect');
    const clearEmpFilterBtn = document.getElementById('clearEmpFilterBtn');

    if(clearEmpFilterBtn) {
        clearEmpFilterBtn.addEventListener('click', () => {
            activeEmpFilter = null; clearEmpFilterBtn.classList.add('hidden');
            let subTitle = document.getElementById('vehicleChartSubtitle');
            if(subTitle) { subTitle.innerText = "รวมทุกคน"; subTitle.className = "text-[10px] md:text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded"; }
            updateDashboard();
        });
    }

    function renderEmpUI() {
        if(!empContainer) return;
        empContainer.innerHTML = '';
        if(compEmpSelect) compEmpSelect.innerHTML = '<option value="ALL">รวมพนักงานทุกคน</option>';
        Object.entries(employeeMapping).forEach(([id, name]) => {
            addEmpRow(id, name);
            if (!name.includes("(ช่าง)")) {
                let opt = document.createElement('option');
                opt.value = id; opt.innerText = `${name} (รหัส ${id})`;
                if(compEmpSelect) compEmpSelect.appendChild(opt);
            }
        });
    }

    function addEmpRow(id = '', name = '') {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 bg-gray-50 border border-gray-200 p-2 rounded hover:border-red-300 transition-colors';
        row.innerHTML = `
            <input type="text" placeholder="รหัส" value="${id}" class="emp-id w-14 p-1.5 text-center text-sm border rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-medium text-gray-700">
            <input type="text" placeholder="ชื่อ" value="${name}" class="emp-name flex-1 p-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-red-500 text-gray-700">
            <button class="remove-btn text-gray-400 hover:text-red-500 p-1 font-bold text-lg leading-none transition-colors" title="ลบ">&times;</button>
        `;
        row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
        empContainer.appendChild(row);
    }

    let addBtn = document.getElementById('addEmpBtn');
    if(addBtn) addBtn.addEventListener('click', () => addEmpRow());

    let saveBtn = document.getElementById('saveConfigBtn');
    if(saveBtn) {
        saveBtn.addEventListener('click', () => {
            let newMap = {};
            empContainer.querySelectorAll('div.flex').forEach(row => {
                const id = row.querySelector('.emp-id').value.trim();
                const name = row.querySelector('.emp-name').value.trim();
                if (id && name) newMap[id] = name;
            });
            if (Object.keys(newMap).length === 0) return showToast("กรุณาใส่ข้อมูลพนักงานอย่างน้อย 1 คน", "error");
            employeeMapping = newMap;
            renderEmpUI(); showToast("บันทึกการตั้งค่าเรียบร้อย", "success");
            if (rawAttendant.length > 0) updateDashboard();
        });
    }

    let btnQuickMonth = document.getElementById('btnQuickMonth');
    if (btnQuickMonth) {
        btnQuickMonth.addEventListener('click', () => {
            if(rawAttendant.length === 0) return showToast("กรุณาอัปโหลดข้อมูลก่อนใช้งานปุ่มลัด", "error");
            let latest = new Date(0);
            rawAttendant.forEach(row => {
                let dStr = row['Open Date'] || row['Date'];
                if(dStr) {
                    let d = new Date(dStr);
                    if(isNaN(d)) {
                        let p = dStr.split(/[-/]/);
                        if(p.length === 3) d = p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0]);
                    }
                    if(!isNaN(d) && d > latest) latest = d;
                }
            });
            if(latest.getTime() === new Date(0).getTime()) return showToast("ไม่พบข้อมูลวันที่ในระบบ", "error");

            let currentYear = latest.getFullYear(); let currentMonth = latest.getMonth(); 
            let prevMonth = currentMonth - 1; let prevYear = currentYear;
            if(prevMonth < 0) { prevMonth = 11; prevYear--; }
            const formatDate = (y, m, d) => `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            document.getElementById('comp1Start').value = formatDate(prevYear, prevMonth, 1);
            document.getElementById('comp1End').value = formatDate(prevYear, prevMonth, new Date(prevYear, prevMonth + 1, 0).getDate());
            document.getElementById('comp2Start').value = formatDate(currentYear, currentMonth, 1);
            document.getElementById('comp2End').value = formatDate(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
            document.getElementById('btnCompare').click(); showToast("ดึงข้อมูลเดือนล่าสุดและเดือนก่อนหน้าสำเร็จ", "success");
        });
    }

    let btnCompare = document.getElementById('btnCompare');
    if (btnCompare) {
        btnCompare.addEventListener('click', () => {
            if(rawAttendant.length === 0) return showToast("กรุณาอัปโหลดข้อมูลก่อน", "error");
            const empId = document.getElementById('compEmpSelect').value;
            const start1 = document.getElementById('comp1Start').value; const end1 = document.getElementById('comp1End').value;
            const start2 = document.getElementById('comp2Start').value; const end2 = document.getElementById('comp2End').value;
            if(!start1 || !end1 || !start2 || !end2) return showToast("กรุณาเลือกช่วงวันที่ให้ครบถ้วน", "error");
            
            const getStatsForPeriod = (start, end) => {
                let vol = 0, vpVol = 0, lifts = 0;
                rawAttendant.forEach(row => {
                    let d = row['Open Date'] || row['Date'];
                    if(row['Category Name'] === 'Fuels' && d >= start && d <= end) {
                        if(empId !== "ALL" && row['Attendant'] !== empId) return;
                        if(empId === "ALL") {
                            let name = employeeMapping[row['Attendant']] || "";
                            if(name.includes("(ช่าง)")) return;
                        }
                        let v = parseFloat(row['Volume']) || 0; let l = parseInt(row['Delivery Count']) || 0;
                        let pName = (row['Product Name'] || "").toUpperCase();
                        let isVpower = pName.includes("VP ") || pName.includes("V-POWER") || pName.includes("VPOWER");
                        if(v > 0) { vol += v; lifts += l; if(isVpower) vpVol += v; }
                    }
                });
                return { vol, vpVol, mix: vol > 0 ? (vpVol/vol)*100 : 0, lifts };
            };

            const p1 = getStatsForPeriod(start1, end1); const p2 = getStatsForPeriod(start2, end2);
            const updateDiffUI = (val1, val2, elementId) => {
                let diff = val1 > 0 ? ((val2 - val1) / val1) * 100 : (val2 > 0 ? 100 : 0);
                let el = document.getElementById(elementId);
                if(diff > 0) { el.innerHTML = `▲ +${diff.toFixed(1)}%`; el.className = "text-lg md:text-xl font-bold py-1 rounded bg-green-100 text-green-700"; } 
                else if(diff < 0) { el.innerHTML = `▼ ${diff.toFixed(1)}%`; el.className = "text-lg md:text-xl font-bold py-1 rounded bg-red-100 text-red-700"; } 
                else { el.innerHTML = `- คงที่ (0%)`; el.className = "text-lg md:text-xl font-bold py-1 rounded bg-gray-100 text-gray-600"; }
            };

            document.getElementById('rVol1').innerText = p1.vol.toLocaleString(undefined, {maximumFractionDigits:0});
            document.getElementById('rVol2').innerText = p2.vol.toLocaleString(undefined, {maximumFractionDigits:0});
            updateDiffUI(p1.vol, p2.vol, 'rVolDiff');
            
            document.getElementById('rVp1').innerText = p1.mix.toFixed(1) + '%';
            document.getElementById('rVp2').innerText = p2.mix.toFixed(1) + '%';
            let mixDiff = p2.mix - p1.mix; let elMix = document.getElementById('rVpDiff');
            if(mixDiff > 0) { elMix.innerHTML = `▲ +${mixDiff.toFixed(1)}%`; elMix.className = "text-lg md:text-xl font-bold py-1 rounded bg-green-100 text-green-700"; }
            else if(mixDiff < 0) { elMix.innerHTML = `▼ ${mixDiff.toFixed(1)}%`; elMix.className = "text-lg md:text-xl font-bold py-1 rounded bg-red-100 text-red-700"; }
            else { elMix.innerHTML = `- คงที่`; elMix.className = "text-lg md:text-xl font-bold py-1 rounded bg-gray-100 text-gray-600"; }
            
            document.getElementById('rLift1').innerText = p1.lifts.toLocaleString();
            document.getElementById('rLift2').innerText = p2.lifts.toLocaleString();
            updateDiffUI(p1.lifts, p2.lifts, 'rLiftDiff');
            document.getElementById('compResultArea').classList.remove('hidden');
        });
    }
    renderEmpUI(); 
});

let exportBtn = document.getElementById('exportBtn');
if(exportBtn) {
    exportBtn.addEventListener('click', () => {
        showToast("กำลังประมวลผลรูปภาพ...", "info");
        let isDark = document.documentElement.classList.contains('dark');
        let targetEl = document.getElementById('dashboardSection');
        let scrollers = targetEl.querySelectorAll('.overflow-x-auto');
        scrollers.forEach(el => { el.classList.remove('overflow-x-auto'); el.style.overflow = 'visible'; });

        html2canvas(targetEl, { 
            scale: 2, 
            backgroundColor: isDark ? "#111827" : "#f3f4f6",
            windowWidth: 1440,
            onclone: function(clonedDoc) {
                let dashSec = clonedDoc.getElementById('dashboardSection');
                if (dashSec) { dashSec.style.width = '1440px'; dashSec.style.maxWidth = '1440px'; }
            }
        }).then(canvas => {
            scrollers.forEach(el => { el.classList.add('overflow-x-auto'); el.style.overflow = ''; });
            let link = document.createElement('a');
            let dateVal = document.getElementById('dateFilter') ? document.getElementById('dateFilter').value : 'Export';
            link.download = `Report_${siteName}_${dateVal}.png`;
            link.href = canvas.toDataURL("image/png"); link.click();
            showToast("ดาวน์โหลดรายงานสำเร็จ", "success");
        }).catch(err => {
            scrollers.forEach(el => el.classList.add('overflow-x-auto'));
            showToast("เกิดข้อผิดพลาดในการสร้างภาพ", "error");
        });
    });
}

// --- File Handlers ---
const fileInput = document.getElementById('fileUpload');
const dropZone = document.getElementById('dropZone');
const dateFilter = document.getElementById('dateFilter');
const hourlyDayFilter = document.getElementById('hourlyDayFilter');

if(fileInput) fileInput.addEventListener('change', handleFiles);
if(dropZone) {
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); fileInput.files = e.dataTransfer.files; handleFiles({ target: fileInput }); });
}

if(dateFilter) {
    dateFilter.addEventListener('change', () => {
        activeEmpFilter = null; 
        let btn = document.getElementById('clearEmpFilterBtn');
        if(btn) btn.classList.add('hidden');
        let sub = document.getElementById('vehicleChartSubtitle');
        if(sub) { sub.innerText = "รวมทุกคน"; sub.className = "text-[10px] md:text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded"; }
        updateDashboard();
    });
}
if(hourlyDayFilter) hourlyDayFilter.addEventListener('change', () => processHourlyData(filteredHourlyData));

function handleFiles(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    document.getElementById('fileStatus').innerHTML = '';
    let filesProcessed = 0; rawAttendant = []; rawHourly = []; rawProduct = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateFileBadge(file.name, 'loading');
        Papa.parse(file, {
            header: true, skipEmptyLines: true, encoding: "UTF-16", delimiter: "\t",
            complete: function(results) {
                const data = results.data;
                if (data.length > 0 && data[0]['Category Name'] === undefined) {
                    showToast(`ไฟล์ ${file.name} โครงสร้างไม่ถูกต้อง`, "error"); updateFileBadge(file.name, 'error');
                } else {
                    updateFileBadge(file.name, 'success');
                    if (data.length > 0 && data[0]['Site Name'] && siteName === "ไม่ระบุสาขา") {
                        siteName = data[0]['Site Name'];
                        document.getElementById('dynamicSiteName').innerText = `สาขา: ${siteName}`;
                    }
                    if (file.name.includes("Attendant")) rawAttendant = rawAttendant.concat(data);
                    else if (file.name.includes("Hourly")) rawHourly = rawHourly.concat(data);
                    else if (file.name.includes("Product")) rawProduct = rawProduct.concat(data);
                }
                filesProcessed++;
                if (filesProcessed === files.length) {
                    if (rawAttendant.length > 0 || rawHourly.length > 0 || rawProduct.length > 0) {
                        document.getElementById('dashboardSection').classList.remove('hidden');
                        let exBtn = document.getElementById('exportBtn'); if(exBtn) exBtn.classList.remove('hidden');
                        populateDateFilter(); updateDashboard(); showToast("ประมวลผลข้อมูลสำเร็จ", "success");
                    }
                }
            }
        });
    }
}

function updateFileBadge(filename, status) {
    let color = status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                (status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 
                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300');
    let icon = status === 'success' ? '✅ ' : (status === 'error' ? '❌ ' : '⏳ ');
    const badgeId = 'badge-' + filename.replace(/[^a-zA-Z0-9]/g, '');
    let badge = document.getElementById(badgeId);
    if (!badge) { badge = document.createElement('span'); badge.id = badgeId; document.getElementById('fileStatus').appendChild(badge); }
    badge.className = `px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600 ${color}`;
    badge.innerText = icon + filename.substring(0, 20) + '...';
}

function populateDateFilter() {
    let dates = new Set();
    const extractDate = (row) => { let d = row['Open Date'] || row['Date']; if (d) dates.add(d); };
    rawAttendant.forEach(extractDate); rawHourly.forEach(extractDate);
    if(!dateFilter) return;
    dateFilter.innerHTML = '<option value="ALL">รวมทุกวัน (All Dates)</option>';
    Array.from(dates).sort().forEach(d => {
        let opt = document.createElement('option'); opt.value = d; opt.innerText = d; dateFilter.appendChild(opt);
    });
    dateFilter.disabled = false;
}

function updateDashboard() {
    if(!dateFilter) return;
    const sd = dateFilter.value;
    const filterFn = (r) => sd === "ALL" || r['Open Date'] === sd || r['Date'] === sd;
    
    filteredHourlyData = rawHourly.filter(filterFn); 
    processData(rawAttendant.filter(filterFn), rawProduct.filter(filterFn));
    processHourlyData(filteredHourlyData);
    
    if (sd === "ALL") {
        processForecast(rawAttendant);
    } else {
        document.getElementById('forecastInfoText').innerText = "*ไม่สามารถคาดการณ์รายเดือนได้ เนื่องจากกำลังกรองรายวัน";
        document.getElementById('forecastResult').innerText = "N/A";
        document.getElementById('forecastProgressBar').style.width = '0%';
        document.getElementById('forecastStatusBox').className = "p-2 md:p-3 rounded text-center flex flex-col justify-center items-center col-span-2 md:col-span-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700";
        document.getElementById('forecastStatusText').innerText = "กรุณาเลือก 'รวมทุกวัน'";
        document.getElementById('forecastStatusText').className = "text-xs md:text-sm font-bold text-gray-500";
        document.getElementById('forecastRunRate').innerText = "-";
    }
}

function processForecast(attData) {
    if (attData.length === 0) return;
    let latestDate = new Date(0);
    let hasValidDate = false;
    
    // หาเดือนล่าสุดในข้อมูล
    attData.forEach(row => {
        let dStr = row['Open Date'] || row['Date'];
        if (dStr) {
            let d = new Date(dStr);
            if (isNaN(d)) { 
                let parts = dStr.split(/[-/]/);
                if (parts.length === 3) d = parts[0].length === 4 ? new Date(parts[0], parts[1]-1, parts[2]) : new Date(parts[2], parts[1]-1, parts[0]);
            }
            if (!isNaN(d) && d > latestDate) { latestDate = d; hasValidDate = true; }
        }
    });

    if (!hasValidDate) return;
    let targetMonth = latestDate.getMonth();
    let targetYear = latestDate.getFullYear();
    let monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    
    let currentMonthSvpVol = 0;
    let activeDates = new Set();
    
    // คำนวณยอดสะสมของเดือนล่าสุด
    attData.forEach(row => {
        let dStr = row['Open Date'] || row['Date'];
        if (!dStr) return;
        let d = new Date(dStr);
        if (isNaN(d)) {
            let parts = dStr.split(/[-/]/);
            if (parts.length === 3) d = parts[0].length === 4 ? new Date(parts[0], parts[1]-1, parts[2]) : new Date(parts[2], parts[1]-1, parts[0]);
        }
        
        if (!isNaN(d) && d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
            if (row['Category Name'] === 'Fuels') {
                let pName = (row['Product Name'] || "").toUpperCase();
                let isVpower = pName.includes("VP ") || pName.includes("V-POWER") || pName.includes("VPOWER");
                let vol = parseFloat(row['Volume']) || 0;
                if (isVpower && vol > 0) { currentMonthSvpVol += vol; activeDates.add(dStr); }
            }
        }
    });

    let targetSvpVol = parseFloat(document.getElementById('targetSvpVolume').value) || 30000;
    let daysPassed = activeDates.size || 1;
    let totalDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate(); 
    
    // 🌟 ส่วนที่เพิ่มใหม่: ตรวจสอบว่าเป็นเดือนที่จบไปแล้ว หรือข้อมูลครบเดือนแล้วใช่ไหม?
    let today = new Date();
    // ถ้า (ปีและเดือนล่าสุด น้อยกว่า ปัจจุบัน) หรือ (จำนวนวันในข้อมูล เท่ากับ จำนวนวันเต็มในเดือน)
    let isMonthEnded = (targetYear < today.getFullYear() || (targetYear === today.getFullYear() && targetMonth < today.getMonth())) || (daysPassed >= totalDaysInMonth);

    let runRate = currentMonthSvpVol / daysPassed;
    let forecastVol = isMonthEnded ? currentMonthSvpVol : (runRate * totalDaysInMonth);

    document.getElementById('forecastTarget').innerText = targetSvpVol.toLocaleString(undefined, {maximumFractionDigits:0});
    document.getElementById('forecastCurrent').innerText = currentMonthSvpVol.toLocaleString(undefined, {maximumFractionDigits:0});
    document.getElementById('forecastResult').innerText = forecastVol.toLocaleString(undefined, {maximumFractionDigits:0});
    
    let statusBox = document.getElementById('forecastStatusBox');
    let statusText = document.getElementById('forecastStatusText');
    let progressBar = document.getElementById('forecastProgressBar');
    let infoText = document.getElementById('forecastInfoText');

    if (isMonthEnded) {
        // กรณีเดือนจบแล้ว ปิดโหมดพยากรณ์ แสดงเป็นสถานะสรุปยอด
        infoText.innerText = `*สรุปยอดข้อมูลเดือน ${monthNames[targetMonth]} ${targetYear} (จบเดือนแล้ว)`;
        document.getElementById('forecastRunRate').innerText = `(เฉลี่ย ${runRate.toLocaleString(undefined, {maximumFractionDigits:0})} ลิตร/วัน)`;
        
        if (currentMonthSvpVol >= targetSvpVol) {
            statusBox.className = "p-2 md:p-3 rounded text-center flex flex-col justify-center items-center col-span-2 md:col-span-1 bg-green-100 border border-green-200 transition-colors dark:bg-green-900 dark:border-green-800";
            statusText.className = "text-xs md:text-sm font-bold text-green-700 dark:text-green-300";
            statusText.innerText = "🏆 ปิดยอด: ทะลุเป้าหมาย";
            progressBar.className = "bg-green-500 h-4 transition-all duration-1000";
        } else {
            statusBox.className = "p-2 md:p-3 rounded text-center flex flex-col justify-center items-center col-span-2 md:col-span-1 bg-red-100 border border-red-200 transition-colors dark:bg-red-900 dark:border-red-800";
            statusText.className = "text-xs md:text-sm font-bold text-red-700 dark:text-red-300";
            statusText.innerText = "❌ ปิดยอด: พลาดเป้าหมาย";
            progressBar.className = "bg-red-500 h-4 transition-all duration-1000";
        }
    } else {
        // กรณีระหว่างเดือน พยากรณ์ตามปกติ
        infoText.innerText = `*ระบบดึงข้อมูลของเดือน ${monthNames[targetMonth]} ${targetYear} มาคำนวณคาดการณ์`;
        document.getElementById('forecastRunRate').innerText = `(เฉลี่ย ${runRate.toLocaleString(undefined, {maximumFractionDigits:0})} ลิตร/วัน)`;
        
        if (forecastVol >= targetSvpVol) {
            statusBox.className = "p-2 md:p-3 rounded text-center flex flex-col justify-center items-center col-span-2 md:col-span-1 bg-green-100 border border-green-200 transition-colors dark:bg-green-900 dark:border-green-800";
            statusText.className = "text-xs md:text-sm font-bold text-green-700 dark:text-green-300";
            statusText.innerText = "✅ มีแนวโน้มทะลุเป้า";
            progressBar.className = "bg-green-500 h-4 transition-all duration-1000";
        } else {
            statusBox.className = "p-2 md:p-3 rounded text-center flex flex-col justify-center items-center col-span-2 md:col-span-1 bg-red-100 border border-red-200 transition-colors dark:bg-red-900 dark:border-red-800";
            statusText.className = "text-xs md:text-sm font-bold text-red-700 dark:text-red-300";
            statusText.innerText = "⚠️ เสี่ยงยอดตกเป้า (เร่งด่วน)";
            progressBar.className = "bg-red-500 h-4 transition-all duration-1000";
        }
    }

    let percent = (forecastVol / targetSvpVol) * 100;
    setTimeout(() => { progressBar.style.width = Math.min(percent, 100) + '%'; }, 100);
}
function processData(attData, prdData) {
    let globalStats = { totalVol: 0, vpowerVol: 0, totalCars: 0, totalBills: 0, goPlusBills: 0 };
    let employeeStats = {};
    let empActiveDates = {}; // 🌟 ตัวแปรใหม่: เก็บนับจำนวนวันทำงานจริงของพนักงานแต่ละคน
    let vehicleStats = { "2W": { name: "มอเตอร์ไซค์ (2 ล้อ)", vpower: 0, normal: 0 }, "4W": { name: "รถยนต์ (4 ล้อ)", vpower: 0, normal: 0 }, "HEAVY": { name: "รถใหญ่ (บรรทุก)", vpower: 0, normal: 0 } };
    let activeEmpCountForAvg = 0; 

    attData.forEach(row => {
        if (row['Category Name'] === 'Fuels') {
            let dStr = row['Open Date'] || row['Date'];
            let empId = row['Attendant'];
            let volume = parseFloat(row['Volume']) || 0;
            let deliveryCount = parseInt(row['Delivery Count']) || 0;
            let pName = (row['Product Name'] || "").toUpperCase();
            let vCode = (row['Vehicle Code'] || "").trim().toUpperCase();
            
            if (!empId || volume <= 0) return;
            let isVpower = pName.includes("VP ") || pName.includes("V-POWER") || pName.includes("VPOWER");
            let empRawName = employeeMapping[empId] || `รหัส ${empId}`;

            // เก็บวันทำงานจริงของพนักงานคนนี้
            if (!empActiveDates[empRawName]) empActiveDates[empRawName] = new Set();
            if (dStr) empActiveDates[empRawName].add(dStr);

            if (!employeeStats[empRawName]) {
                employeeStats[empRawName] = { totalVol: 0, vpowerVol: 0, normalVol: 0, deliveryCount: 0 };
                if (!empRawName.includes("(ช่าง)") && !empRawName.includes("(แคช)")) activeEmpCountForAvg++;
            }
            
            employeeStats[empRawName].totalVol += volume;
            employeeStats[empRawName].deliveryCount += deliveryCount;
            globalStats.totalVol += volume;
            
            if (isVpower) { employeeStats[empRawName].vpowerVol += volume; globalStats.vpowerVol += volume; } 
            else { employeeStats[empRawName].normalVol += volume; }

            if (!activeEmpFilter || empRawName === activeEmpFilter) {
                let vGroup = "OTHER";
                if(vCode === "2W") vGroup = "2W"; else if(vCode === "4W") vGroup = "4W"; else if(vCode === "HEAVY") vGroup = "HEAVY";
                if (vehicleStats[vGroup]) {
                    if(isVpower) vehicleStats[vGroup].vpower += volume; else vehicleStats[vGroup].normal += volume;
                }
            }
        }
    });

    prdData.forEach(row => {
        if (row['Category Name'] === 'Fuels') {
            let loyalty = (row['Loyalty'] || "").toUpperCase();
            let count = parseInt(row['Delivery Count']) || parseInt(row['Purchase Count']) || 0;
            if(count > 0) {
                globalStats.totalBills += count;
                if (loyalty.includes("GO+") || (loyalty !== "NOLOYALTY" && loyalty !== "")) globalStats.goPlusBills += count;
            }
        }
    });

    // แสดงผลเป้าหมายลิตรรวม
    let targetTotalMonth = parseFloat(document.getElementById('targetTotalVolume').value) || 150000;
    document.getElementById('kpiTotalTargetLabel').innerText = `เป้าหมายเดือน: ${targetTotalMonth.toLocaleString()} ลิตร`;
    let kpiTotalVolEl = document.getElementById('kpiTotalVol');
    kpiTotalVolEl.innerText = globalStats.totalVol.toLocaleString(undefined, {maximumFractionDigits: 0});
    if(globalStats.totalVol >= targetTotalMonth) kpiTotalVolEl.className = "text-lg md:text-2xl font-bold text-blue-600 mt-1 transition-colors";
    else kpiTotalVolEl.className = "text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 transition-colors";

    // แสดงผล V-Power Mix
    let targetVp = parseFloat(document.getElementById('targetVpMix').value) || 20;
    let vMix = globalStats.totalVol > 0 ? (globalStats.vpowerVol / globalStats.totalVol) * 100 : 0;
    document.getElementById('kpiTargetLabel').innerText = `เป้าหมาย: ${targetVp}%`;
    let vpElement = document.getElementById('kpiVpowerMix');
    vpElement.innerText = vMix.toFixed(1) + '%';
    if (vMix >= targetVp) vpElement.className = "text-lg md:text-2xl font-bold text-green-600 mt-1 transition-colors";
    else vpElement.className = "text-lg md:text-2xl font-bold text-red-600 mt-1 transition-colors";
    
    let goMix = globalStats.totalBills > 0 ? ((globalStats.goPlusBills / globalStats.totalBills) * 100).toFixed(1) : 0;
    document.getElementById('kpiGoPlusMix').innerText = goMix + '%';

    let sortedEmp = Object.entries(employeeStats).sort((a, b) => b[1].totalVol - a[1].totalVol);
    let originalNames = sortedEmp.map(i => i[0]);
    let empLabels = sortedEmp.map(item => {
        let mix = ((item[1].vpowerVol / item[1].totalVol) * 100).toFixed(1);
        let lifts = item[1].deliveryCount.toLocaleString();
        return `${item[0].replace(/\(แคช\)|\(ช่าง\)/g, '').trim()} (VP: ${mix}% | ยก: ${lifts})`;
    });

    let avgVolPerEmp = activeEmpCountForAvg > 0 ? (globalStats.totalVol / activeEmpCountForAvg) : 0;
    renderEmployeeChart(empLabels, sortedEmp.map(i => i[1].vpowerVol), sortedEmp.map(i => i[1].normalVol), avgVolPerEmp, originalNames);

    let vehLabels = []; let vehVP = []; let vehNM = [];
    ["2W", "4W", "HEAVY"].forEach(vType => {
        let stat = vehicleStats[vType];
        let mix = (stat.vpower + stat.normal) > 0 ? ((stat.vpower / (stat.vpower + stat.normal)) * 100).toFixed(1) : 0;
        vehLabels.push(`${stat.name} (VP: ${mix}%)`); vehVP.push(stat.vpower); vehNM.push(stat.normal);
    });
    renderVehicleChart(vehLabels, vehVP, vehNM);

    buildKpiTable(sortedEmp, empActiveDates); // ส่ง Active Days ไปคำนวณ
}

function buildKpiTable(sortedEmp, empActiveDates) {
    let tbody = document.getElementById('kpiTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // ดึงเป้า SVP
    let tForecourtVP = parseFloat(document.getElementById('targetDailyForecourt').value) || 190;
    let tCashierVP = parseFloat(document.getElementById('targetDailyCashier').value) || 85;
    let tTechVP = parseFloat(document.getElementById('targetDailyTech').value) || 85;
    
    // ดึงเป้า ลิตรรวม
    let tForecourtTot = parseFloat(document.getElementById('targetDailyTotalForecourt').value) || 1000;
    let tCashierTot = parseFloat(document.getElementById('targetDailyTotalCashier').value) || 500;
    let tTechTot = parseFloat(document.getElementById('targetDailyTotalTech').value) || 500;

    sortedEmp.forEach(([name, stats]) => {
        // 🌟 การแก้ปัญหาความไม่แฟร์: หาจำนวนวันทำงานจริงของแต่ละคน
        let activeDays = empActiveDates[name] ? empActiveDates[name].size : 1; 

        let dTargetVP = tForecourtVP; let dTargetTot = tForecourtTot;
        
        if (name.includes("(แคช)")) {
            dTargetVP = tCashierVP; dTargetTot = tCashierTot;
        } else if (name.includes("(ช่าง)")) {
            dTargetVP = tTechVP; dTargetTot = tTechTot;
        }

        let periodTargetVP = dTargetVP * activeDays;
        let periodTargetTot = dTargetTot * activeDays;

        let actualVP = stats.vpowerVol;
        let actualTot = stats.totalVol;

        let diffVP = actualVP - periodTargetVP;
        let diffTot = actualTot - periodTargetTot;
        
        let statusVP = actualVP >= periodTargetVP 
            ? `<span class="text-green-600 font-bold">✅ ผ่าน (+${diffVP.toLocaleString(undefined,{maximumFractionDigits:0})})</span>` 
            : `<span class="text-red-600 font-bold">❌ ตก (${diffVP.toLocaleString(undefined,{maximumFractionDigits:0})})</span>`;
            
        let statusTot = actualTot >= periodTargetTot 
            ? `<span class="text-blue-600 font-bold">✅ ผ่าน (+${diffTot.toLocaleString(undefined,{maximumFractionDigits:0})})</span>` 
            : `<span class="text-red-600 font-bold">❌ ตก (${diffTot.toLocaleString(undefined,{maximumFractionDigits:0})})</span>`;

        let cleanName = name.replace(/\(แคช\)|\(ช่าง\)/g, '').trim();

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100 dark:border-gray-700">
                <td class="py-3 px-3 text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200">${cleanName}</td>
                <td class="py-3 px-2 text-center text-xs md:text-sm text-gray-500 border-r dark:border-gray-700">${activeDays} วัน</td>
                
                <!-- น้ำมันรวม -->
                <td class="py-3 px-3 text-right text-xs md:text-sm text-blue-600 bg-blue-50/50">${periodTargetTot.toLocaleString()}</td>
                <td class="py-3 px-3 text-right text-sm md:text-base font-bold text-blue-700 bg-blue-50/50">${actualTot.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                <td class="py-3 px-3 text-center text-xs md:text-sm bg-blue-50/50 border-r dark:border-gray-700">${statusTot}</td>
                
                <!-- SVP -->
                <td class="py-3 px-3 text-right text-xs md:text-sm text-purple-600 bg-purple-50/50">${periodTargetVP.toLocaleString()}</td>
                <td class="py-3 px-3 text-right text-sm md:text-base font-bold text-purple-700 bg-purple-50/50">${actualVP.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                <td class="py-3 px-3 text-center text-xs md:text-sm bg-purple-50/50">${statusVP}</td>
            </tr>
        `;
    });
}

function processHourlyData(hrData) {
    let hourlyCars = {}; let uniqueDates = new Set(); let totalCarsCalculated = 0; let selectedDay = document.getElementById('hourlyDayFilter').value;

    hrData.forEach(row => {
        if (row['Category Name'] === 'Fuels') {
            let dateStr = row['Date']; let hourStr = row['Hour']; let cars = parseInt(row['Delivery Count']) || 0;
            if (!hourStr || !dateStr) return;
            let dateObj = new Date(dateStr);
            if (isNaN(dateObj)) { let parts = dateStr.split(/[-/]/); if (parts.length === 3) dateObj = parts[0].length === 4 ? new Date(parts[0], parts[1]-1, parts[2]) : new Date(parts[2], parts[1]-1, parts[0]); }
            if (!isNaN(dateObj)) {
                let dayOfWeek = dateObj.getDay(); 
                if (selectedDay !== "ALL" && dayOfWeek !== parseInt(selectedDay)) return;
                uniqueDates.add(dateStr); totalCarsCalculated += cars;
                let cleanHour = hourStr.length === 4 ? "0" + hourStr : hourStr;
                if (!hourlyCars[cleanHour]) hourlyCars[cleanHour] = 0;
                hourlyCars[cleanHour] += cars;
            }
        }
    });
    if (selectedDay === "ALL") { let el = document.getElementById('kpiTotalCars'); if(el) el.innerText = totalCarsCalculated.toLocaleString(); }
    let numDays = uniqueDates.size || 1; let sortedHours = Object.keys(hourlyCars).sort();
    let chartData = sortedHours.map(h => Math.round(hourlyCars[h] / numDays)); 
    renderHourlyChart(sortedHours, chartData);
}

// --- Charts ---
Chart.defaults.font.family = "'Prompt', sans-serif";

function renderEmployeeChart(labels, vpowerData, normalData, averageVol, originalNames) {
    const ctx = document.getElementById('employeeChart').getContext('2d');
    if(charts.emp) charts.emp.destroy();
    
    let annotationConfig = {};
    if (averageVol > 0) {
        annotationConfig = {
            annotations: {
                line1: {
                    type: 'line', yMin: averageVol, yMax: averageVol, borderColor: 'rgba(34, 197, 94, 0.9)', borderWidth: 2, borderDash: [5, 5],
                    label: { display: true, content: 'ค่าเฉลี่ยสถานี (หน้าลาน)', position: 'end', backgroundColor: 'rgba(34, 197, 94, 0.9)' }
                }
            }
        };
    }

    let bgVp = originalNames.map(name => (activeEmpFilter && name !== activeEmpFilter) ? 'rgba(221, 29, 33, 0.2)' : '#dd1d21');
    let bgNm = originalNames.map(name => (activeEmpFilter && name !== activeEmpFilter) ? 'rgba(251, 206, 7, 0.2)' : '#fbce07');

    charts.emp = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: labels, datasets: [ { label: 'V-Power', data: vpowerData, backgroundColor: bgVp, stack: 'Stack 0' }, { label: 'มาตรฐาน', data: normalData, backgroundColor: bgNm, stack: 'Stack 0' } ] }, 
        options: { 
            responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, annotation: annotationConfig }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const dataIndex = elements[0].index; activeEmpFilter = originalNames[dataIndex];
                    let btn = document.getElementById('clearEmpFilterBtn'); if(btn) btn.classList.remove('hidden');
                    let subTitle = document.getElementById('vehicleChartSubtitle');
                    let cleanName = activeEmpFilter.replace(/\(แคช\)|\(ช่าง\)/g, '').trim();
                    if(subTitle) { subTitle.innerText = `เฉพาะ: ${cleanName}`; subTitle.className = "text-[10px] md:text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded"; }
                    updateDashboard(); 
                }
            }
        } 
    });
}

function renderVehicleChart(labels, vpowerData, normalData) {
    const ctx = document.getElementById('vehicleChart').getContext('2d'); if(charts.veh) charts.veh.destroy();
    charts.veh = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [ { label: 'V-Power', data: vpowerData, backgroundColor: '#dd1d21', stack: 'Stack 1' }, { label: 'มาตรฐาน', data: normalData, backgroundColor: '#fbce07', stack: 'Stack 1' } ] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true } } } });
}
function renderHourlyChart(labels, data) {
    const ctx = document.getElementById('hourlyChart').getContext('2d'); if(charts.hr) charts.hr.destroy();
    charts.hr = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'เฉลี่ยรถเข้าลาน/วัน (คัน)', data: data, borderColor: '#dd1d21', backgroundColor: 'rgba(221, 29, 33, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: '#fbce07' }] }, options: { responsive: true, maintainAspectRatio: false } });
}
