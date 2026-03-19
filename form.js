// 1. SECURITY CHECK
const currentUser = localStorage.getItem('loggedInUser');
if (!currentUser) {
    window.location.href = "index.html"; 
}

// 2. CONFIGURATION
const supabaseUrl = 'https://kmcjfqetnmnuoggofakz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttY2pmcWV0bm1udW9nZ29mYWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDQzMTgsImV4cCI6MjA4OTE4MDMxOH0.p-t21iaY91hGzekxJos4ClKAwhbQ3uJcMCo-g-PrH14';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let activeTimers = {};
let currentPlotPending = "";
const cameraInput = document.getElementById('cameraInput');
const plotData = {
    "BNN": ["B1", "B2", "B3", "B4"],
    "UNN1": ["U1", "U2", "U3", "U4", "U5"],
    "UNN2": ["N1", "N2", "N3"]
};

// --- INITIALIZATION ---
function updateSyncUI(count) {
    const bar = document.getElementById('offlineSyncStatus');
    const text = document.getElementById('statusText');
    if (!bar || !text) return;
    
    if (count > 0) {
        bar.style.display = 'block';
        bar.style.backgroundColor = '#fff3cd'; // Yellow
        bar.style.color = '#856404';
        text.innerHTML = `⏳ Offline Mode: ${count} record(s) waiting for signal...`;
    } else {
        bar.style.backgroundColor = '#d4edda'; // Green
        bar.style.color = '#155724';
        text.innerHTML = `✅ All records uploaded to Supabase!`;
        setTimeout(() => { bar.style.display = 'none'; }, 3000);
    }
}

// UPDATED: Now calls fetchLatestRecords on load
window.onload = function() {
    const saved = localStorage.getItem('activeWateringSessions');
    if (saved) {
        activeTimers = JSON.parse(saved);
        renderActiveSessions();
    }
    syncOfflineData(); 
    fetchLatestRecords(); // Pull latest 10 records from DB
};

// --- DATABASE FETCH LOGIC ---
async function fetchLatestRecords() {
    // 1. Fetch using 'end_time' to get the latest finished tasks
    const { data, error } = await _supabase
        .from('watering_logs')
        .select('*')
        .order('end_time', { ascending: false }) 
        .limit(10);

    if (error) {
        console.error('Error fetching records:', error);
        return;
    }

    const logBody = document.getElementById('logBody');
    const grandTotalElement = document.getElementById('grandTotal');
    
    logBody.innerHTML = '';
    let totalMinutes = 0;

        data.forEach(record => {
        const row = document.createElement('tr');
        
        const dur = parseFloat(record.duration || 0);
        totalMinutes += dur;

        const timeDone = record.end_time ? new Date(record.end_time).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : '-';

        // Helper to create small thumbnail HTML if URL exists
        const imgStyle = "width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid #eee; margin-right: 4px; vertical-align: middle;";
        
        const startImg = record.start_photo_url 
            ? `<img src="${record.start_photo_url}" style="${imgStyle}" onclick="window.open(this.src)" title="Start Photo">` 
            : '';
        
        const endImg = record.end_photo_url 
            ? `<img src="${record.end_photo_url}" style="${imgStyle}" onclick="window.open(this.src)" title="End Photo">` 
            : '';

        row.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${record.user_email ? record.user_email.split('@')[0] : 'User'}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${record.plot_name || '-'}</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; min-width: 90px;">
                ${startImg}${endImg}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
                <div style="font-weight: bold; color: #28a745;">${dur.toFixed(2)} min</div>
                <div style="font-size: 11px; color: #999;">Selesai: ${timeDone}</div>
            </td>
        `;
        logBody.appendChild(row);
    });

    if (grandTotalElement) {
        grandTotalElement.innerText = totalMinutes.toFixed(2) + ' min';
    }
}

// --- DROPDOWN LOGIC ---
function syncPlotOptions(locId, plotId) {
    const locValue = document.getElementById(locId).value;
    const plotDropdown = document.getElementById(plotId);
    plotDropdown.innerHTML = '<option value="">-- Select Plot --</option>';
    if (locValue && plotData[locValue]) {
        plotData[locValue].forEach(plot => {
            let option = document.createElement("option");
            option.value = plot;
            option.text = plot;
            plotDropdown.add(option);
        });
    }
}

// --- IMAGE COMPRESSION ---
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1024; 
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.4); 
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// --- WATERING ACTIONS ---
function triggerStartCamera() {
    const plot = document.getElementById('plotSelect').value;
    if (!plot) return alert("Please select a Plot No!");
    if (activeTimers[plot]) return alert("Plot is already active!");
    currentPlotPending = plot;
    cameraInput.click();
}

cameraInput.onchange = function() {
    if (this.files && this.files.length > 0) {
        const plot = currentPlotPending;
        compressImage(this.files[0], (compressedBase64) => {
            activeTimers[plot] = { 
                startTime: new Date().toISOString(),
                startPhotoData: compressedBase64 
            };
            localStorage.setItem('activeWateringSessions', JSON.stringify(activeTimers));
            renderActiveSessions();
        });
        this.value = ''; 
    }
};

function triggerEndCamera(plot) {
    currentPlotPending = plot;
    const endCamera = document.createElement('input');
    endCamera.type = 'file';
    endCamera.accept = 'image/*';
    endCamera.capture = 'camera';
    endCamera.onchange = function() {
        if (this.files && this.files.length > 0) {
            compressImage(this.files[0], (compressedBase64) => {
                finalizeStop(plot, compressedBase64);
            });
        }
    };
    endCamera.click();
}

async function finalizeStop(plot, compressedEndBase64) {
    const endTime = new Date();
    const session = activeTimers[plot];
    if (!session) return;

    const startDateObj = new Date(session.startTime);
    const durationMins = parseFloat(((endTime - startDateObj) / (1000 * 60)).toFixed(2));

    const pendingRecord = {
        user_email: currentUser,
        plot_name: plot,
        start_time: startDateObj.toISOString(),
        end_time: endTime.toISOString(),
        duration: durationMins,
        start_photo_data: session.startPhotoData,
        end_photo_data: compressedEndBase64,
        timestamp: Date.now()
    };

    let queue = JSON.parse(localStorage.getItem('pending_sync_queue') || "[]");
    queue.push(pendingRecord);
    localStorage.setItem('pending_sync_queue', JSON.stringify(queue));

    delete activeTimers[plot];
    localStorage.setItem('activeWateringSessions', JSON.stringify(activeTimers));
    renderActiveSessions();
    syncOfflineData(); 
}

// --- ISSUE REPORTING ---
function reportIssue() {
    const plot = document.getElementById('issuePlotSelect').value;
    const reason = document.getElementById('reasonDropdown').value;
    if (!plot || !reason) return alert("Please select both a Plot and a Reason!");

    const now = new Date().toISOString();
    const issueRecord = {
        user_email: currentUser,
        plot_name: plot,
        start_time: now,
        end_time: now,
        duration: 0,
        issue_reason: reason,
        timestamp: Date.now() 
    };

    let queue = JSON.parse(localStorage.getItem('pending_sync_queue') || "[]");
    queue.push(issueRecord);
    localStorage.setItem('pending_sync_queue', JSON.stringify(queue));

    alert("Issue saved to phone memory!");
    syncOfflineData(); 
}

// --- SYNC ENGINE ---
async function syncOfflineData() {
    let queue = JSON.parse(localStorage.getItem('pending_sync_queue') || "[]");
    if (queue.length === 0) {
        updateSyncUI(0);
        return;
    }

    updateSyncUI(queue.length);

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        try {
            let payload = {
                user_email: item.user_email,
                plot_name: item.plot_name,
                start_time: item.start_time,
                end_time: item.end_time,
                duration: item.duration,
                issue_reason: item.issue_reason || null
            };

            if (item.start_photo_data && item.end_photo_data) {
                const ts = item.timestamp || Date.now();
                const sPath = `${ts}_${item.plot_name}_S.jpg`;
                const ePath = `${ts}_${item.plot_name}_E.jpg`;

                const sBlob = await (await fetch(item.start_photo_data)).blob();
                const eBlob = await (await fetch(item.end_photo_data)).blob();

                await _supabase.storage.from('watering-photos').upload(sPath, sBlob, { contentType: 'image/jpeg', upsert: true });
                await _supabase.storage.from('watering-photos').upload(ePath, eBlob, { contentType: 'image/jpeg', upsert: true });

                payload.start_photo_url = _supabase.storage.from('watering-photos').getPublicUrl(sPath).data.publicUrl;
                payload.end_photo_url = _supabase.storage.from('watering-photos').getPublicUrl(ePath).data.publicUrl;
            }

            const { error: dbErr } = await _supabase.from('watering_logs').insert([payload]);
            if (dbErr) throw dbErr;

            queue.splice(i, 1);
            localStorage.setItem('pending_sync_queue', JSON.stringify(queue));
            i--; 
            updateSyncUI(queue.length);
            
            // Refresh table after each successful upload
            fetchLatestRecords();

        } catch (err) {
            console.error("SYNC ERROR:", err.message);
            break; 
        }
    }
}

// --- UI RENDERING ---
function renderActiveSessions() {
    const area = document.getElementById('activeSessionsArea');
    if (!area) return;
    area.innerHTML = '<h4>Plot Sedang Disiram:</h4>';
    const plots = Object.keys(activeTimers);
    if (plots.length === 0) {
        area.innerHTML += '<p style="color:gray">Tiada plot sedang disiram.</p>';
        return;
    }
    plots.forEach(plot => {
        area.innerHTML += `
            <div class="active-session" style="background:#f9f9f9; padding:10px; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #ddd;">
                <div><strong>${plot}</strong></div>
                <button class="stop-btn-small" onclick="triggerEndCamera('${plot}')" style="background:#e91e63; color:white; border:none; padding:8px 12px; border-radius:5px;">📸 Selesai</button>
            </div>`;
    });
}

function showTab(tabName) {
    const stage = document.getElementById('tabStage');
    const btnWater = document.getElementById('btnWater');
    const btnIssue = document.getElementById('btnIssue');

    if (tabName === 'wateringSection') {
        // Slide to Watering
        stage.style.transform = 'translateX(0)';
        
        // Active Style
        btnWater.style.background = '#28a745';
        btnWater.style.color = 'white';
        btnWater.style.border = '1px solid #28a745';
        btnWater.style.borderBottom = 'none';
        
        // Inactive Style
        btnIssue.style.background = '#ddd';
        btnIssue.style.color = '#555';
        btnIssue.style.border = '1px solid #ddd';
        btnIssue.style.borderLeft = 'none';
        btnIssue.style.borderBottom = 'none';
    } else {
        // Slide to Issues (-50% because the stage is 200% wide)
        stage.style.transform = 'translateX(-50%)';
        
        // Active Style
        btnIssue.style.background = '#d9534f';
        btnIssue.style.color = 'white';
        btnIssue.style.border = '1px solid #d9534f';
        btnIssue.style.borderBottom = 'none';
        
        // Inactive Style
        btnWater.style.background = '#ddd';
        btnWater.style.color = '#555';
        btnWater.style.border = '1px solid #ddd';
        btnWater.style.borderBottom = 'none';
    }
}

function logout() {
    const queue = JSON.parse(localStorage.getItem('pending_sync_queue') || "[]");
    if (queue.length > 0) {
        if (!confirm("You have " + queue.length + " records not uploaded. Logout anyway?")) return;
    }
    localStorage.removeItem('loggedInUser');
    window.location.href = "index.html";
}

window.addEventListener('online', syncOfflineData);
setInterval(() => {
    let queue = JSON.parse(localStorage.getItem('pending_sync_queue') || "[]");
    if (queue.length > 0) syncOfflineData();
}, 30000);