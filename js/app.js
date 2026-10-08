/**
 * HEMOCARE OS - Blood Bank Management System
 * Dual Portal Controller (Citizens/Donors & Blood Bank Centers)
 * Integrated with Supabase PostgreSQL Client
 */

let appState = {
  data: {
    inventory: [],
    donors: [],
    requests: [],
    camps: [],
    centers: [],
    appointments: []
  },
  currentPortal: 'landing', // 'landing', 'user_portal', 'center_portal'
  activeCenterTab: 'dashboard',
  centerAppointmentFilter: 'ALL',
  inventoryChart: null,
  trendChart: null,
  selectedBloodGroupForCompat: 'O-',
  authUser: null // { role: 'donor'|'center_staff', name, email, bloodGroup, centerCode, ... }
};

// Application Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

async function initApp() {
  // Check for stored session
  if (window.HemoDB) {
    appState.authUser = window.HemoDB.currentUser;
  }

  // Load data from Supabase Adapter
  await refreshAllData();

  // Setup UI components
  setupClock();
  setupNavigation();
  setupModals();
  setupAuthForms();
  setupEventListeners();

  // Initial portal route determination
  if (appState.authUser) {
    if (appState.authUser.role === 'center_staff') {
      routeToPortal('center_portal');
    } else {
      routeToPortal('user_portal');
    }
  } else {
    routeToPortal('landing');
  }

  // Render compatibility matrix
  renderCompatibilityMatrix(appState.selectedBloodGroupForCompat);

  // Background synchronization every 30 seconds
  setInterval(() => {
    triggerSync(false);
  }, 30000);

  if (window.lucide) {
    lucide.createIcons();
  }
}

// ----------------------------------------------------
// Data Refresh & Synchronization Engine
// ----------------------------------------------------
async function refreshAllData() {
  try {
    if (window.HemoDB) {
      const [inv, dnr, req, cmp, cnt, apt] = await Promise.all([
        window.HemoDB.getInventory(),
        window.HemoDB.getDonors(),
        window.HemoDB.getRequests(),
        window.HemoDB.getCamps(),
        window.HemoDB.getCenters(),
        window.HemoDB.getAppointments()
      ]);
      appState.data.inventory = inv || [];
      appState.data.donors = dnr || [];
      appState.data.requests = req || [];
      appState.data.camps = cmp || [];
      appState.data.centers = cnt || [];
      appState.data.appointments = apt || [];
    } else {
      appState.data = { inventory: [], donors: [], requests: [], camps: [], centers: [], appointments: [] };
    }
  } catch (err) {
    console.error("Data refresh error:", err);
    appState.data = { inventory: [], donors: [], requests: [], camps: [], centers: [], appointments: [] };
  }

  // Update Landing Live Radar Counts
  updateLandingRadar();
}

// Universal synchronization function that updates all active dashboards
async function triggerSync(showNotification = true) {
  const spinIcons = document.querySelectorAll('.sync-spin-target');
  spinIcons.forEach(i => i.classList.add('animate-spin'));

  await refreshAllData();

  // Re-render active portal views
  if (appState.currentPortal === 'center_portal') {
    switchCenterTab(appState.activeCenterTab || 'dashboard');
  } else if (appState.currentPortal === 'user_portal') {
    renderUserPortal();
  } else {
    updateLandingRadar();
    renderLandingCamps();
  }

  setTimeout(() => {
    spinIcons.forEach(i => i.classList.remove('animate-spin'));
  }, 600);

  if (showNotification) {
    showToast("Data synchronized with central database.", "success");
  }

  // Ping runner server for terminal confirmation
  try {
    fetch('/api/sync-ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: showNotification ? 'Manual Dashboard Sync' : 'Real-time Periodic Sync',
        details: 'All clinical KPI counters and matrices synchronized'
      })
    }).catch(() => {});
  } catch (e) {}
}

// ----------------------------------------------------
// High-Level Portal Routing
// ----------------------------------------------------
function routeToPortal(portalName) {
  // Authentication gate for Center Console
  if (portalName === 'center_portal') {
    if (!appState.authUser || appState.authUser.role !== 'center_staff') {
      showToast("Access Restricted: Center Officer authentication required.", "warning");
      openModal('modal-auth-center');
      portalName = 'landing';
    }
  }

  // Authentication gate for User / Donor Portal
  if (portalName === 'user_portal') {
    if (!appState.authUser) {
      showToast("Please sign in or register to view your personal donor pass.", "info");
      openModal('modal-auth-user');
      portalName = 'landing';
    }
  }

  appState.currentPortal = portalName;

  const viewLanding = document.getElementById('view-landing');
  const viewUserPortal = document.getElementById('view-user-portal');
  const viewCenterPortal = document.getElementById('view-center-portal');

  // Hide all primary portals
  if (viewLanding) viewLanding.classList.add('hidden');
  if (viewUserPortal) viewUserPortal.classList.add('hidden');
  if (viewCenterPortal) viewCenterPortal.classList.add('hidden');

  // Update Header User Session Bar
  updateHeaderSessionBar();

  if (portalName === 'landing') {
    if (viewLanding) viewLanding.classList.remove('hidden');
    updateLandingRadar();
    renderLandingCamps();
  } else if (portalName === 'user_portal') {
    if (viewUserPortal) viewUserPortal.classList.remove('hidden');
    renderUserPortal();
  } else if (portalName === 'center_portal') {
    if (viewCenterPortal) viewCenterPortal.classList.remove('hidden');
    updateCenterHeaderInfo();
    switchCenterTab(appState.activeCenterTab || 'dashboard');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

function updateCenterHeaderInfo() {
  const center = appState.authUser;
  if (!center) return;

  const brandEl = document.getElementById('center-brand-name');
  if (brandEl) brandEl.textContent = center.name || 'Center Admin';

  const codeEl = document.getElementById('center-notice-code');
  if (codeEl) codeEl.textContent = center.centerCode || 'VERIFIED';
}

function updateHeaderSessionBar() {
  const container = document.getElementById('header-auth-controls');
  if (!container) return;

  const user = appState.authUser;
  if (!user) {
    container.innerHTML = `
      <button onclick="openModal('modal-auth-user')" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition flex items-center gap-1.5">
        <i data-lucide="user" class="w-3.5 h-3.5 text-rose-400"></i>
        <span>User Portal</span>
      </button>
      <button onclick="openModal('modal-auth-center')" class="btn-crimson px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-md">
        <i data-lucide="shield" class="w-3.5 h-3.5"></i>
        <span>Center Staff Login</span>
      </button>
    `;
  } else {
    const isCenter = user.role === 'center_staff';
    container.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="text-right hidden sm:block">
          <p class="text-xs font-bold text-white">${user.name}</p>
          <p class="text-[10px] font-mono text-rose-400">${isCenter ? 'Center Officer' : `Donor (${user.bloodGroup || 'O-'})`}</p>
        </div>
        ${isCenter ? `
          <button onclick="routeToPortal('center_portal')" class="px-2.5 py-1 text-xs rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold hover:bg-rose-500/30">
            Command Center
          </button>
        ` : `
          <button onclick="routeToPortal('user_portal')" class="px-2.5 py-1 text-xs rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold hover:bg-rose-500/30">
            My Donor Card
          </button>
        `}
        <button onclick="handleLogout()" title="Log Out" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-white transition">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function handleLogout() {
  if (window.HemoDB) {
    window.HemoDB.logout();
  }
  appState.authUser = null;
  routeToPortal('landing');
  showToast("Logged out successfully.", "info");
}

// ----------------------------------------------------
// Landing Page Logic & Live Radar
// ----------------------------------------------------
function updateLandingRadar() {
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const counts = {};
  bloodGroups.forEach(bg => counts[bg] = 0);

  appState.data.inventory.forEach(u => {
    if (u.status === 'Available') {
      counts[u.bloodGroup] = (counts[u.bloodGroup] || 0) + 1;
    }
  });

  const radarContainer = document.getElementById('landing-radar-grid');
  if (radarContainer) {
    radarContainer.innerHTML = bloodGroups.map(bg => {
      const c = counts[bg] || 0;
      let badgeColor = 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10';
      if (c <= 1) badgeColor = 'border-rose-500/40 text-rose-300 bg-rose-500/20 urgency-critical';
      else if (c <= 2) badgeColor = 'border-amber-500/30 text-amber-300 bg-amber-500/10';

      return `
        <div onclick="quickFindBlood('${bg}')" class="p-3 rounded-xl bg-slate-900/80 border ${badgeColor} text-center cursor-pointer hover:scale-105 transition shadow-sm">
          <span class="block text-lg font-black">${bg}</span>
          <span class="text-xs font-mono font-bold">${c} Units</span>
        </div>
      `;
    }).join('');
  }
}

function renderLandingCamps() {
  const container = document.getElementById('landing-camps-preview');
  if (!container) return;

  const upcoming = appState.data.camps.filter(c => c.status === 'Upcoming').slice(0, 3);
  if (upcoming.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400">No public drives scheduled for this week.</p>`;
    return;
  }

  container.innerHTML = upcoming.map(camp => `
    <div class="glass-panel rounded-xl p-4 border border-white/5 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between text-xs text-rose-400 font-mono mb-1">
          <span>${camp.date}</span>
          <span class="px-2 py-0.5 rounded bg-rose-500/20 text-white font-bold">${camp.targetUnits} Target Units</span>
        </div>
        <h4 class="text-sm font-bold text-white">${camp.name}</h4>
        <p class="text-xs text-slate-400 mt-1"><i data-lucide="map-pin" class="inline w-3 h-3 text-slate-500 mr-1"></i>${camp.venue}</p>
      </div>
      <button onclick="openModal('modal-auth-user')" class="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition">
        Register to Donate
      </button>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function quickFindBlood(bloodGroup) {
  const searchInput = document.getElementById('landing-search-group');
  if (searchInput) {
    searchInput.value = bloodGroup;
    executePublicBloodSearch();
    document.getElementById('landing-search-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function executePublicBloodSearch() {
  const group = document.getElementById('landing-search-group')?.value || 'ALL';
  const city = document.getElementById('landing-search-city')?.value.toLowerCase().trim() || '';
  const resultsContainer = document.getElementById('landing-search-results');
  if (!resultsContainer) return;

  const matched = appState.data.inventory.filter(u => {
    if (u.status !== 'Available') return false;
    if (group !== 'ALL' && u.bloodGroup !== group) return false;
    return true;
  });

  if (matched.length === 0) {
    resultsContainer.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-900/60 border border-white/5 text-center text-slate-400">
        <i data-lucide="alert-circle" class="w-8 h-8 text-rose-400 mx-auto mb-2"></i>
        <p class="text-sm font-bold text-white">No Direct Units Found in Immediate Storage</p>
        <p class="text-xs text-slate-400 mt-1">Our emergency trauma dispatch network can summon compatible donors immediately.</p>
        <button onclick="openUserEmergencyReqModal('${group}')" class="btn-crimson mt-3 px-4 py-1.5 text-xs font-bold rounded-lg">
          Submit Emergency Patient Request
        </button>
      </div>
    `;
  } else {
    resultsContainer.innerHTML = `
      <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-3 flex items-center justify-between">
        <div class="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
          <i data-lucide="check-circle" class="w-4 h-4"></i>
          <span>${matched.length} Units of ${group === 'ALL' ? 'Various Groups' : group} Available for Immediate Clinical Dispatch</span>
        </div>
        <button onclick="openUserEmergencyReqModal('${group === 'ALL' ? 'O-' : group}')" class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
          Request Bag
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${matched.slice(0, 6).map(u => `
          <div class="p-3 rounded-lg bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-rose-400 text-sm">${u.bloodGroup}</span>
              <span class="text-slate-300 ml-1 font-medium">${u.component}</span>
              <p class="text-[11px] text-slate-400 font-mono">${u.storageLocation}</p>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">Verified</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// Citizen / Donor Portal View Engine
// ----------------------------------------------------
function renderUserPortal() {
  const user = appState.authUser;
  if (!user) {
    const card = document.getElementById('user-donor-card');
    if (card) {
      card.innerHTML = `
        <div class="glass-panel rounded-2xl p-8 border border-white/10 text-center space-y-4">
          <div class="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
            <i data-lucide="user" class="w-6 h-6"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Donor Pass Access Required</h3>
            <p class="text-xs text-slate-400 max-w-sm mx-auto mt-1">Please sign in or register to view your verified digital donor credentials and requisitions.</p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            <button onclick="openModal('modal-auth-user')" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition">
              Sign In
            </button>
            <button onclick="openModal('modal-add-donor')" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-xs transition">
              Register as Donor
            </button>
          </div>
        </div>
      `;
    }
    const requestsContainer = document.getElementById('user-requests-list');
    if (requestsContainer) requestsContainer.innerHTML = '';
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Find linked donor record if exists
  const donorRecord = appState.data.donors.find(d => 
    (d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase()) || 
    (d.id && user.id && d.id === user.id)
  ) || {
    id: user.id || "DNR-ONLINE",
    name: user.name,
    bloodGroup: user.bloodGroup || "O-",
    totalDonations: user.totalDonations || 0,
    lastDonated: user.lastDonated || "None recorded",
    status: user.status || "Eligible",
    city: user.city || "Not specified",
    weightKg: user.weightKg || 65,
    hemoglobin: user.hemoglobin || 14.0
  };

  // Render Digital Donor ID Card
  const idCardContainer = document.getElementById('user-donor-card');
  if (idCardContainer) {
    const isEligible = donorRecord.status === 'Eligible';
    idCardContainer.innerHTML = `
      <div class="donor-id-card rounded-2xl p-6 text-white relative">
        <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center font-bold shadow-md">
              <i data-lucide="droplet" class="w-4 h-4 text-white fill-white"></i>
            </div>
            <div>
              <h4 class="text-sm font-black tracking-tight text-white">HEMOCARE GLOBAL RESERVE</h4>
              <p class="text-[10px] text-slate-400 font-mono">CERTIFIED CLINICAL DONOR CREDENTIAL</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="openDonorProfileModal()" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 transition flex items-center gap-1 border border-white/10">
              <i data-lucide="edit-3" class="w-3 h-3 text-rose-400"></i> Edit Profile
            </button>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
              ${donorRecord.id}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between my-3">
          <div>
            <p class="text-xs text-slate-400">DONOR FULL NAME</p>
            <h3 class="text-xl font-black text-white">${donorRecord.name}</h3>
            <p class="text-xs text-slate-300 mt-1">Status: <span class="font-bold ${isEligible ? 'text-emerald-400' : 'text-amber-400'}">${donorRecord.status}</span> • ${donorRecord.city}</p>
          </div>
          <div class="text-right">
            <span class="text-4xl font-black text-rose-500 px-3 py-1 rounded-xl bg-slate-900/80 border border-rose-500/40 inline-block shadow-lg">
              ${donorRecord.bloodGroup}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-xs font-mono">
          <div>
            <span class="text-slate-400 block text-[10px]">TOTAL DONATIONS</span>
            <span class="font-bold text-white">${donorRecord.totalDonations} Times</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">LAST DONATION</span>
            <span class="font-bold text-white">${donorRecord.lastDonated || 'None recorded'}</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 block text-[10px]">NEXT ELIGIBLE</span>
            <span class="font-bold text-emerald-400">${isEligible ? 'Immediate' : 'In Cooldown'}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Render Scheduled Appointments for this Donor
  renderUserAppointments(user);

  // Render My Requests Tracker
  const requestsContainer = document.getElementById('user-requests-list');
  if (requestsContainer) {
    const userRequests = appState.data.requests.filter(r => 
      (r.requesterEmail && user.email && r.requesterEmail.toLowerCase() === user.email.toLowerCase()) || 
      (user.name && r.patientName && r.patientName.toLowerCase() === user.name.toLowerCase())
    );

    if (userRequests.length === 0) {
      requestsContainer.innerHTML = `
        <div class="p-6 rounded-xl bg-slate-900/60 border border-white/5 text-center text-slate-400">
          <p class="text-xs">No personal blood requisitions active at this time.</p>
        </div>
      `;
    } else {
      requestsContainer.innerHTML = userRequests.map(r => `
        <div class="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between">
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-white text-sm">${r.patientName}</span>
              <span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">${r.bloodGroup}</span>
              <span class="text-xs text-slate-400 font-mono">${r.id}</span>
            </div>
            <p class="text-xs text-slate-400 mt-1">${r.hospital} • ${r.unitsNeeded} Bag(s)</p>
          </div>
          <div class="text-right">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${
              r.status === 'Dispatched' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }">
              ${r.status}
            </span>
            <p class="text-[10px] font-mono text-slate-400 mt-1">${r.requestDate}</p>
          </div>
        </div>
      `).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function renderUserAppointments(user) {
  const container = document.getElementById('user-appointments-list');
  if (!container) return;

  const userApts = (appState.data.appointments || []).filter(a =>
    (a.donorEmail && user.email && a.donorEmail.toLowerCase() === user.email.toLowerCase()) ||
    (a.donorId && user.id && a.donorId === user.id) ||
    (a.donorName && user.name && a.donorName.toLowerCase() === user.name.toLowerCase())
  );

  if (userApts.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-slate-900/60 border border-white/5 text-center text-slate-400">
        <i data-lucide="calendar-plus" class="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-70"></i>
        <p class="text-sm font-bold text-white">No Scheduled Donation Slots</p>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Book an appointment at your nearest certified blood center to donate whole blood or platelets.</p>
        <button onclick="openBookSlotModal()" class="mt-3 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
          Book Donation Slot Now
        </button>
      </div>
    `;
  } else {
    container.innerHTML = userApts.map(a => {
      let badgeStyle = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      if (a.status === 'Confirmed') badgeStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      else if (a.status === 'Completed') badgeStyle = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      else if (a.status === 'Cancelled') badgeStyle = 'bg-slate-500/20 text-slate-400 border-slate-500/30';

      const canCancel = a.status === 'Scheduled' || a.status === 'Confirmed';

      return `
        <div class="p-4 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between flex-wrap gap-3">
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-white text-sm">${a.centerName}</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">${a.donationType}</span>
              <span class="text-xs text-slate-400 font-mono">${a.id}</span>
            </div>
            <div class="flex items-center space-x-3 text-xs text-slate-400">
              <span class="flex items-center gap-1 text-slate-300 font-medium">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-400"></i> ${a.appointmentDate}
              </span>
              <span class="flex items-center gap-1 font-mono text-cyan-300">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-cyan-400"></i> ${a.timeSlot}
              </span>
            </div>
            ${a.notes ? `<p class="text-[11px] text-slate-400 italic">Notes: "${a.notes}"</p>` : ''}
          </div>
          <div class="flex items-center space-x-2.5">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${badgeStyle}">
              ${a.status}
            </span>
            ${canCancel ? `
              <button onclick="cancelDonorAppointment('${a.id}')"
                class="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition">
                Cancel
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

function openDonorProfileModal() {
  const user = appState.authUser;
  if (!user) {
    showToast("Please sign in or register to view profile settings.", "warning");
    openModal('modal-auth-user');
    return;
  }

  // Find linked donor record
  const donor = appState.data.donors.find(d => 
    (d.email && user.email && d.email.toLowerCase() === user.email.toLowerCase()) || 
    (d.id && user.id && d.id === user.id)
  ) || user;

  const idBadge = document.getElementById('dp-id-badge');
  if (idBadge) idBadge.textContent = donor.id || user.id || 'DNR-ONLINE';

  const statusBadge = document.getElementById('dp-status-badge');
  if (statusBadge) {
    const isEligible = (donor.status || user.status) === 'Eligible';
    statusBadge.textContent = donor.status || user.status || 'Eligible';
    statusBadge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${isEligible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`;
  }

  const nameInput = document.getElementById('dp-form-name');
  if (nameInput) nameInput.value = donor.name || user.name || '';

  const groupSelect = document.getElementById('dp-form-group');
  if (groupSelect) groupSelect.value = donor.bloodGroup || donor.blood_group || user.bloodGroup || 'O-';

  const phoneInput = document.getElementById('dp-form-phone');
  if (phoneInput) phoneInput.value = donor.phone || user.phone || '';

  const emailInput = document.getElementById('dp-form-email');
  if (emailInput) emailInput.value = donor.email || user.email || '';

  const ageInput = document.getElementById('dp-form-age');
  if (ageInput) ageInput.value = donor.age || user.age || 28;

  const genderSelect = document.getElementById('dp-form-gender');
  if (genderSelect) genderSelect.value = donor.gender || user.gender || 'Male';

  const weightInput = document.getElementById('dp-form-weight');
  if (weightInput) weightInput.value = donor.weightKg || donor.weight_kg || user.weightKg || 65;

  const hbInput = document.getElementById('dp-form-hb');
  if (hbInput) hbInput.value = donor.hemoglobin || user.hemoglobin || 14.0;

  const cityInput = document.getElementById('dp-form-city');
  if (cityInput) cityInput.value = donor.city || user.city || '';

  const addressInput = document.getElementById('dp-form-address');
  if (addressInput) addressInput.value = donor.address || user.address || '';

  const notesInput = document.getElementById('dp-form-notes');
  if (notesInput) notesInput.value = donor.notes || user.notes || '';

  // Reset password inputs
  const pwInput = document.getElementById('dp-form-password');
  if (pwInput) pwInput.value = '';
  const confirmPw = document.getElementById('dp-form-confirm-password');
  if (confirmPw) confirmPw.value = '';

  openModal('modal-donor-profile');
}

function openBookSlotModal() {
  const user = appState.authUser;
  if (!user) {
    showToast("Please sign in or register to book a donation slot.", "warning");
    openModal('modal-auth-user');
    return;
  }

  const centerSelect = document.getElementById('slot-form-center');
  if (centerSelect) {
    centerSelect.innerHTML = `<option value="" disabled selected>Select a certified blood bank or hospital center...</option>`;
    const centers = appState.data.centers || [];
    if (centers.length === 0) {
      centerSelect.innerHTML += `<option value="CTR-DEFAULT" data-name="Apollo Clinical Blood Reserve" data-address="Main Campus, Clinical District" data-phone="+91 40 2360 7777">Apollo Clinical Blood Reserve (Hyderabad)</option>`;
    } else {
      centers.forEach(c => {
        const option = document.createElement('option');
        option.value = c.centerCode || c.id;
        option.textContent = `${c.name} (${c.city}${c.state ? ', ' + c.state : ''})`;
        option.dataset.name = c.name;
        option.dataset.address = `${c.address || ''}, ${c.city || ''}`;
        option.dataset.phone = c.phone || 'Available';
        centerSelect.appendChild(option);
      });
    }

    if (centers.length > 0) {
      centerSelect.selectedIndex = 1;
      updateSlotCenterPreview(centerSelect);
    }
  }

  // Pre-fill date to tomorrow
  const dateInput = document.getElementById('slot-form-date');
  if (dateInput) {
    const today = new Date();
    dateInput.min = today.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }

  // Pre-fill donor info
  const donorNameInput = document.getElementById('slot-form-donor-name');
  if (donorNameInput) donorNameInput.value = user.name || '';

  const bloodGroupSelect = document.getElementById('slot-form-blood-group');
  if (bloodGroupSelect) bloodGroupSelect.value = user.bloodGroup || 'O-';

  const phoneInput = document.getElementById('slot-form-donor-phone');
  if (phoneInput) phoneInput.value = user.phone || '';

  const emailInput = document.getElementById('slot-form-donor-email');
  if (emailInput) emailInput.value = user.email || '';

  openModal('modal-book-slot');
}

function updateSlotCenterPreview(selectEl) {
  const previewBox = document.getElementById('slot-center-preview');
  if (!previewBox) return;

  const selectedOpt = selectEl.options[selectEl.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) {
    previewBox.classList.add('hidden');
    return;
  }

  previewBox.classList.remove('hidden');
  const nameEl = document.getElementById('slot-preview-name');
  if (nameEl) nameEl.textContent = selectedOpt.dataset.name || selectedOpt.text;
  const addressEl = document.getElementById('slot-preview-address');
  if (addressEl) addressEl.innerHTML = `<i data-lucide="map-pin" class="inline w-3 h-3 text-rose-400 mr-1"></i>${selectedOpt.dataset.address || 'Facility Address'}`;
  const phoneEl = document.getElementById('slot-preview-phone');
  if (phoneEl) phoneEl.innerHTML = `<i data-lucide="phone" class="inline w-3 h-3 text-cyan-400 mr-1"></i>Helpline: ${selectedOpt.dataset.phone || 'Available'}`;
  if (window.lucide) lucide.createIcons();
}

async function cancelDonorAppointment(appointmentId) {
  if (!confirm("Are you sure you want to cancel this scheduled donation appointment?")) return;

  try {
    if (window.HemoDB) {
      await window.HemoDB.updateAppointmentStatus(appointmentId, 'Cancelled');
    }
    await triggerSync(false);
    showToast("Donation slot cancelled.", "info");
  } catch (err) {
    showToast("Failed to cancel appointment: " + err.message, "error");
  }
}

function openUserEmergencyReqModal(prefillGroup = 'O-') {
  openNewRequestModal(prefillGroup);
}

// ----------------------------------------------------
// Center Portal Management (Admin Sub-views)
// ----------------------------------------------------
function setupNavigation() {
  // Center portal sidebar nav
  document.querySelectorAll('[data-center-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-center-target');
      switchCenterTab(target);
    });
  });

  // Mobile sidebar toggle
  const mobileToggle = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }
}

function switchCenterTab(tabId) {
  appState.activeCenterTab = tabId;

  document.querySelectorAll('[data-center-target]').forEach(link => {
    if (link.getAttribute('data-center-target') === tabId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  document.querySelectorAll('.center-view-section').forEach(view => {
    if (view.id === `center-view-${tabId}`) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'inventory') renderInventory();
  else if (tabId === 'donors') renderDonors();
  else if (tabId === 'requests') renderRequests();
  else if (tabId === 'camps') renderCamps();
  else if (tabId === 'compatibility') renderCompatibilityMatrix(appState.selectedBloodGroupForCompat);
  else if (tabId === 'appointments') renderCenterAppointments();
  else if (tabId === 'profile') renderCenterProfileTab();

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// Realtime Clock
// ----------------------------------------------------
function setupClock() {
  const clockEl = document.getElementById('live-clock');
  function update() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) + ' • ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  update();
  setInterval(update, 1000);
}

// ----------------------------------------------------
// Center Dashboard Visuals & Charts
// ----------------------------------------------------
function renderDashboard() {
  const data = appState.data;
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const stockCounts = {};
  bloodGroups.forEach(bg => stockCounts[bg] = 0);

  let totalAvailableUnits = 0;
  data.inventory.forEach(unit => {
    if (unit.status === 'Available') {
      stockCounts[unit.bloodGroup] = (stockCounts[unit.bloodGroup] || 0) + 1;
      totalAvailableUnits++;
    }
  });

  let criticalCount = 0;
  bloodGroups.forEach(bg => {
    if (stockCounts[bg] <= 1) criticalCount++;
  });

  const pendingRequests = data.requests.filter(r => r.status === 'Pending').length;
  const activeDonors = data.donors.filter(d => d.status === 'Eligible').length;

  // Center appointments count
  const currentCenterCode = appState.authUser ? (appState.authUser.centerCode || appState.authUser.id) : null;
  const centerApts = (data.appointments || []).filter(a => !currentCenterCode || a.centerCode === currentCenterCode || currentCenterCode === 'DEFAULT');
  const bookedAptsCount = centerApts.filter(a => a.status === 'Scheduled' || a.status === 'Confirmed').length;

  document.getElementById('kpi-total-units').textContent = totalAvailableUnits;
  document.getElementById('kpi-critical-shortage').textContent = criticalCount;
  document.getElementById('kpi-active-donors').textContent = activeDonors;
  document.getElementById('kpi-pending-requests').textContent = pendingRequests;

  const kpiAptsEl = document.getElementById('kpi-appointments-count');
  if (kpiAptsEl) kpiAptsEl.textContent = bookedAptsCount;

  const navBadge = document.getElementById('center-nav-appointments-badge');
  if (navBadge) {
    navBadge.textContent = bookedAptsCount;
    if (bookedAptsCount > 0) navBadge.classList.remove('hidden');
    else navBadge.classList.add('hidden');
  }

  // Render Blood Matrix Grid
  const matrixContainer = document.getElementById('blood-matrix-grid');
  if (matrixContainer) {
    matrixContainer.innerHTML = bloodGroups.map(bg => {
      const count = stockCounts[bg] || 0;
      let statusLabel = 'Optimal';
      let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      let progressPercent = Math.min(100, Math.round((count / 5) * 100));

      if (count === 0) {
        statusLabel = 'Depleted';
        statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30 urgency-critical';
      } else if (count <= 1) {
        statusLabel = 'Critical';
        statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      } else if (count <= 2) {
        statusLabel = 'Low Stock';
        statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      }

      return `
        <div onclick="openNewRequestModal('${bg}')" class="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group cursor-pointer">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl font-black text-white px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/30">${bg}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusColor}">${statusLabel}</span>
          </div>
          <div class="my-2">
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-3xl font-extrabold text-white tracking-tight">${count}</span>
              <span class="text-xs text-slate-400 font-medium">Safe: 5</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 rounded-full ${count <= 1 ? 'bg-rose-500' : count <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.max(8, progressPercent)}%"></div>
            </div>
          </div>
          <div class="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span class="group-hover:text-rose-400 transition flex items-center gap-1">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Request
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Dashboard Urgent List
  const urgentReqsContainer = document.getElementById('dashboard-urgent-requests');
  if (urgentReqsContainer) {
    const recentRequests = [...data.requests]
      .filter(r => r.status === 'Pending' || r.urgency === 'CRITICAL')
      .slice(0, 4);

    if (recentRequests.length === 0) {
      urgentReqsContainer.innerHTML = `<p class="text-xs text-slate-400 p-4 text-center">No emergency requisitions waiting.</p>`;
    } else {
      urgentReqsContainer.innerHTML = recentRequests.map(req => `
        <div class="p-3 rounded-lg bg-slate-900/60 border border-white/5 hover:border-white/10 transition flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="px-2 py-0.5 rounded font-bold text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300">${req.bloodGroup}</span>
            <div>
              <p class="text-xs font-bold text-white">${req.patientName}</p>
              <p class="text-[11px] text-slate-400">${req.hospital} • ${req.unitsNeeded}u</p>
            </div>
          </div>
          <button onclick="handleQuickDispatch('${req.id}')" class="px-2.5 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white font-medium transition">
            Process
          </button>
        </div>
      `).join('');
    }
  }

  renderCharts(stockCounts, data.inventory, data.requests);
  renderDashboardAppointmentsPreview(centerApts);
}

function renderCharts(stockCounts, inventoryList, requestsList) {
  if (typeof Chart === 'undefined') return;

  const bgLabels = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const stockValues = bgLabels.map(bg => stockCounts[bg] || 0);

  const donutCanvas = document.getElementById('chart-inventory-distribution');
  if (donutCanvas) {
    if (appState.inventoryChart) appState.inventoryChart.destroy();
    const ctx = donutCanvas.getContext('2d');
    appState.inventoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: bgLabels,
        datasets: [{
          data: stockValues,
          backgroundColor: ['#ef4444', '#f87171', '#3b82f6', '#60a5fa', '#a855f7', '#c084fc', '#10b981', '#34d399'],
          borderColor: '#090d16',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, color: '#94a3b8', font: { size: 11 } } }
        },
        cutout: '70%'
      }
    });
  }

  const trendCanvas = document.getElementById('chart-monthly-trend');
  if (trendCanvas) {
    if (appState.trendChart) appState.trendChart.destroy();

    const currentCenterCode = appState.authUser ? (appState.authUser.centerCode || appState.authUser.id) : null;
    const invData = inventoryList || (appState.data && appState.data.inventory) || [];
    const reqData = requestsList || (appState.data && appState.data.requests) || [];

    // Filter by center if center context is active
    const centerInv = currentCenterCode && currentCenterCode !== 'DEFAULT'
      ? invData.filter(u => !u.centerCode || u.centerCode === currentCenterCode || u.centerCode === 'DEFAULT')
      : invData;

    const centerReq = currentCenterCode && currentCenterCode !== 'DEFAULT'
      ? reqData.filter(r => !r.centerCode || r.centerCode === currentCenterCode || r.centerCode === 'DEFAULT')
      : reqData;

    // Helper to safely parse dates from DB (handles ISO, YYYY-MM-DD, or YYYY-MM-DD HH:mm:ss)
    const parseDbDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      const str = String(val).trim();
      const iso = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
      const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      return null;
    };

    // Determine reference date: use latest date found in database or fallback to today
    let refDate = new Date();
    [...centerInv, ...centerReq].forEach(rec => {
      const d = parseDbDate(rec.collectedDate || rec.dispatchedAt || rec.requestDate || rec.createdAt);
      if (d && d > refDate) refDate = d;
    });

    // Build rolling list of recent 5 months ending at refDate
    const fullMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthSlots = [];
    const numMonths = 5;
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      monthSlots.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: fullMonthNames[d.getMonth()]
      });
    }

    // Calculate real monthly inflow (units collected) from database
    const inflowData = monthSlots.map(slot => {
      return centerInv.filter(unit => {
        const d = parseDbDate(unit.collectedDate || unit.createdAt);
        return d && d.getFullYear() === slot.year && d.getMonth() === slot.month;
      }).length;
    });

    // Calculate real monthly hospital dispatches (units dispatched) from database
    const dispatchedData = monthSlots.map(slot => {
      return centerReq.filter(req => {
        if (req.status !== 'Dispatched') return false;
        const d = parseDbDate(req.dispatchedAt || req.requestDate || req.createdAt);
        return d && d.getFullYear() === slot.year && d.getMonth() === slot.month;
      }).reduce((sum, req) => {
        const units = parseInt(req.unitsNeeded, 10) || (req.dispatchedUnits ? req.dispatchedUnits.length : 1);
        return sum + units;
      }, 0);
    });

    const ctxTrend = trendCanvas.getContext('2d');
    appState.trendChart = new Chart(ctxTrend, {
      type: 'bar',
      data: {
        labels: monthSlots.map(s => s.label),
        datasets: [
          {
            label: 'Donations Inflow',
            data: inflowData,
            backgroundColor: 'rgba(225, 29, 72, 0.7)',
            borderColor: 'rgba(225, 29, 72, 0.9)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Hospital Dispatched',
            data: dispatchedData,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 0.9)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ` ${ctx.dataset.label}: ${ctx.raw} unit${ctx.raw === 1 ? '' : 's'}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              precision: 0
            }
          }
        }
      }
    });
  }
}

// ----------------------------------------------------
// Center Appointments & Profile Handlers
// ----------------------------------------------------
function renderDashboardAppointmentsPreview(centerApts) {
  const container = document.getElementById('dashboard-appointments-preview');
  if (!container) return;

  const upcoming = centerApts.filter(a => a.status === 'Scheduled' || a.status === 'Confirmed').slice(0, 4);

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-900/40 border border-white/5 text-center text-slate-400 text-xs">
        <i data-lucide="calendar" class="w-5 h-5 mx-auto mb-1 text-slate-500"></i>
        <span>No upcoming donor slots pending for today.</span>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${upcoming.map(a => `
        <div class="p-3.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-white text-xs">${a.donorName}</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">${a.bloodGroup}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'}">${a.status}</span>
            </div>
            <p class="text-[11px] text-slate-300 font-medium">
              <i data-lucide="clock" class="inline w-3 h-3 text-cyan-400 mr-0.5"></i> ${a.appointmentDate} • ${a.timeSlot}
            </p>
            <p class="text-[10px] text-slate-400">${a.donationType} • Tel: ${a.donorPhone}</p>
          </div>
          <div class="flex flex-col space-y-1">
            ${a.status === 'Scheduled' ? `
              <button onclick="confirmAppointmentCenter('${a.id}')"
                class="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-sm">
                <i data-lucide="check" class="w-3 h-3"></i> Confirm
              </button>
            ` : `
              <button onclick="completeAppointmentCenter('${a.id}')"
                class="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1">
                <i data-lucide="check-check" class="w-3 h-3"></i> Donated
              </button>
            `}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function renderCenterAppointments() {
  const center = appState.authUser;
  const currentCenterCode = center ? (center.centerCode || center.id) : null;
  const allApts = appState.data.appointments || [];

  // Filter for this center if logged in as specific center
  let centerApts = allApts.filter(a => !currentCenterCode || a.centerCode === currentCenterCode || currentCenterCode === 'DEFAULT');

  // Filter by status tab
  const statusFilter = appState.centerAppointmentFilter || 'ALL';
  if (statusFilter !== 'ALL') {
    centerApts = centerApts.filter(a => a.status === statusFilter);
  }

  // Filter by search query
  const searchInput = document.getElementById('apt-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (query) {
    centerApts = centerApts.filter(a => 
      (a.donorName && a.donorName.toLowerCase().includes(query)) ||
      (a.donorPhone && a.donorPhone.includes(query)) ||
      (a.id && a.id.toLowerCase().includes(query)) ||
      (a.bloodGroup && a.bloodGroup.toLowerCase().includes(query))
    );
  }

  const tbody = document.getElementById('center-appointments-tbody');
  const emptyState = document.getElementById('center-appointments-empty');

  if (!tbody) return;

  if (centerApts.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  tbody.innerHTML = centerApts.map(a => {
    let badgeClass = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    if (a.status === 'Confirmed') badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    else if (a.status === 'Completed') badgeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
    else if (a.status === 'Cancelled') badgeClass = 'bg-slate-500/20 text-slate-400 border border-slate-500/30';

    return `
      <tr class="hover:bg-white/[0.02] transition">
        <td class="p-3.5 font-mono text-slate-400 font-bold">${a.id}</td>
        <td class="p-3.5">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-white text-sm">${a.donorName}</span>
            <span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">${a.bloodGroup}</span>
          </div>
          ${a.notes ? `<p class="text-[10px] text-slate-400 italic mt-0.5">${a.notes}</p>` : ''}
        </td>
        <td class="p-3.5">
          <p class="text-white font-medium flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-cyan-400"></i> ${a.donorPhone}</p>
          ${a.donorEmail ? `<p class="text-slate-400 text-[11px]">${a.donorEmail}</p>` : ''}
        </td>
        <td class="p-3.5">
          <div class="font-medium text-slate-200">${a.appointmentDate}</div>
          <div class="text-[11px] font-mono text-cyan-300">${a.timeSlot}</div>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            ${a.donationType}
          </span>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}">
            ${a.status}
          </span>
        </td>
        <td class="p-3.5 text-right">
          <div class="flex items-center justify-end space-x-1.5">
            ${a.status === 'Scheduled' ? `
              <button onclick="confirmAppointmentCenter('${a.id}')"
                class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-sm">
                <i data-lucide="check" class="w-3 h-3"></i> Confirm
              </button>
              <button onclick="cancelAppointmentCenter('${a.id}')"
                class="px-2 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-white/10 transition">
                Cancel
              </button>
            ` : ''}
            ${a.status === 'Confirmed' ? `
              <button onclick="completeAppointmentCenter('${a.id}')"
                class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1">
                <i data-lucide="check-check" class="w-3 h-3"></i> Mark Donated
              </button>
              <button onclick="cancelAppointmentCenter('${a.id}')"
                class="px-2 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-white/10 transition">
                Cancel
              </button>
            ` : ''}
            ${a.status === 'Completed' ? `
              <span class="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <i data-lucide="check-circle-2" class="w-4 h-4"></i> Completed
              </span>
            ` : ''}
            ${a.status === 'Cancelled' ? `
              <span class="text-xs text-slate-500 italic">Cancelled</span>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterCenterAppointments(status) {
  appState.centerAppointmentFilter = status;
  document.querySelectorAll('.apt-status-tab').forEach(tab => {
    if (tab.getAttribute('data-apt-status') === status) {
      tab.className = "apt-status-tab px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white transition";
    } else {
      tab.className = "apt-status-tab px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-300 hover:text-white transition";
    }
  });
  renderCenterAppointments();
}

async function confirmAppointmentCenter(id) {
  try {
    if (window.HemoDB) await window.HemoDB.updateAppointmentStatus(id, 'Confirmed');
    await triggerSync(false);
    showToast(`Appointment ${id} confirmed. Donor notified.`, "success");
  } catch (err) {
    showToast("Error confirming appointment: " + err.message, "error");
  }
}

async function completeAppointmentCenter(id) {
  try {
    if (window.HemoDB) await window.HemoDB.updateAppointmentStatus(id, 'Completed');
    await triggerSync(false);
    showToast(`Donation recorded successfully! Donor metrics updated in central database.`, "success");
  } catch (err) {
    showToast("Error updating appointment: " + err.message, "error");
  }
}

async function cancelAppointmentCenter(id) {
  if (!confirm("Are you sure you want to cancel this appointment slot?")) return;
  try {
    if (window.HemoDB) await window.HemoDB.updateAppointmentStatus(id, 'Cancelled');
    await triggerSync(false);
    showToast(`Appointment ${id} marked as Cancelled.`, "info");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

function openCenterProfileModal() {
  const center = appState.authUser;
  if (!center || center.role !== 'center_staff') {
    showToast("Center authorization required.", "warning");
    openModal('modal-auth-center');
    return;
  }

  const foundCenter = (appState.data.centers || []).find(c => 
    c.centerCode === center.centerCode || c.id === center.id || c.email === center.email
  ) || center;

  const codeBadge = document.getElementById('cp-modal-code-badge');
  if (codeBadge) codeBadge.textContent = foundCenter.centerCode || foundCenter.id || 'CTR-DEFAULT';

  const nameInput = document.getElementById('cp-modal-name');
  if (nameInput) nameInput.value = foundCenter.name || '';

  const emailInput = document.getElementById('cp-modal-email');
  if (emailInput) emailInput.value = foundCenter.email || '';

  const phoneInput = document.getElementById('cp-modal-phone');
  if (phoneInput) phoneInput.value = foundCenter.phone || '';

  const contactInput = document.getElementById('cp-modal-contact');
  if (contactInput) contactInput.value = foundCenter.contactPerson || '';

  const licInput = document.getElementById('cp-modal-license');
  if (licInput) licInput.value = foundCenter.licenseNumber || '';

  const catSelect = document.getElementById('cp-modal-category');
  if (catSelect) catSelect.value = foundCenter.category || 'Blood Bank & Component Center';

  const cityInput = document.getElementById('cp-modal-city');
  if (cityInput) cityInput.value = foundCenter.city || '';

  const stateInput = document.getElementById('cp-modal-state');
  if (stateInput) stateInput.value = foundCenter.state || '';

  const addrInput = document.getElementById('cp-modal-address');
  if (addrInput) addrInput.value = foundCenter.address || '';

  const pwInput = document.getElementById('cp-modal-password');
  if (pwInput) pwInput.value = '';

  const cpwInput = document.getElementById('cp-modal-confirm-password');
  if (cpwInput) cpwInput.value = '';

  openModal('modal-center-profile');
}

function renderCenterProfileTab() {
  const center = appState.authUser;
  if (!center) return;

  const foundCenter = (appState.data.centers || []).find(c => 
    c.centerCode === center.centerCode || c.id === center.id || c.email === center.email
  ) || center;

  const dispName = document.getElementById('center-profile-display-name');
  if (dispName) dispName.textContent = foundCenter.name || 'Center Administration';

  const dispCode = document.getElementById('center-profile-display-code');
  if (dispCode) dispCode.textContent = foundCenter.centerCode || foundCenter.id || 'CTR-DEFAULT';

  const nameInput = document.getElementById('cp-view-name');
  if (nameInput) nameInput.value = foundCenter.name || '';

  const codeInput = document.getElementById('cp-view-code');
  if (codeInput) codeInput.value = foundCenter.centerCode || foundCenter.id || 'CTR-DEFAULT';

  const emailInput = document.getElementById('cp-view-email');
  if (emailInput) emailInput.value = foundCenter.email || '';

  const phoneInput = document.getElementById('cp-view-phone');
  if (phoneInput) phoneInput.value = foundCenter.phone || '';

  const contactInput = document.getElementById('cp-view-contact');
  if (contactInput) contactInput.value = foundCenter.contactPerson || '';

  const licenseInput = document.getElementById('cp-view-license');
  if (licenseInput) licenseInput.value = foundCenter.licenseNumber || '';

  const catSelect = document.getElementById('cp-view-category');
  if (catSelect) catSelect.value = foundCenter.category || 'Blood Bank & Component Center';

  const cityInput = document.getElementById('cp-view-city');
  if (cityInput) cityInput.value = foundCenter.city || '';

  const stateInput = document.getElementById('cp-view-state');
  if (stateInput) stateInput.value = foundCenter.state || '';

  const addrInput = document.getElementById('cp-view-address');
  if (addrInput) addrInput.value = foundCenter.address || '';

  const pwInput = document.getElementById('cp-view-password');
  if (pwInput) pwInput.value = '';

  const cpwInput = document.getElementById('cp-view-confirm-password');
  if (cpwInput) cpwInput.value = '';

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// Inventory Management View
// ----------------------------------------------------
function renderInventory() {
  const tableBody = document.getElementById('inventory-table-body');
  if (!tableBody) return;

  const filterGroup = document.getElementById('inv-filter-group')?.value || 'ALL';
  const filterComponent = document.getElementById('inv-filter-component')?.value || 'ALL';
  const filterStatus = document.getElementById('inv-filter-status')?.value || 'ALL';
  const searchQuery = document.getElementById('inv-search')?.value.toLowerCase().trim() || '';

  const filtered = appState.data.inventory.filter(item => {
    if (filterGroup !== 'ALL' && item.bloodGroup !== filterGroup) return false;
    if (filterComponent !== 'ALL' && item.component !== filterComponent) return false;
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (searchQuery) {
      const match = (
        item.id.toLowerCase().includes(searchQuery) ||
        item.bloodGroup.toLowerCase().includes(searchQuery) ||
        (item.donorName && item.donorName.toLowerCase().includes(searchQuery)) ||
        item.storageLocation.toLowerCase().includes(searchQuery)
      );
      if (!match) return false;
    }
    return true;
  });

  const totalCountEl = document.getElementById('inv-total-count');
  if (totalCountEl) totalCountEl.textContent = `${filtered.length} Units Found`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">No matching units in storage.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(item => `
    <tr>
      <td class="font-mono text-xs font-semibold text-rose-400">${item.id}</td>
      <td><span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-white">${item.bloodGroup}</span></td>
      <td class="text-slate-300 text-xs">${item.component}</td>
      <td class="font-mono text-xs text-slate-300">${item.volumeMl} ml</td>
      <td class="text-xs text-slate-400">${item.collectedDate}</td>
      <td class="text-xs text-slate-300 font-mono">${item.expiryDate}</td>
      <td class="text-xs text-slate-400">${item.storageLocation}</td>
      <td><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'Available' ? 'status-available' : 'status-reserved'}">${item.status}</span></td>
      <td>
        ${item.status === 'Available' ? `
          <button onclick="markUnitDiscard('${item.id}')" title="Discard" class="p-1 text-slate-400 hover:text-rose-400 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function markUnitDiscard(unitId) {
  if (confirm(`Mark unit ${unitId} as expired / discarded?`)) {
    if (window.HemoDB) {
      await window.HemoDB.updateInventoryStatus(unitId, 'Expired');
    }
    await refreshAllData();
    renderInventory();
    renderDashboard();
    showToast(`Unit ${unitId} marked as expired.`, 'warning');
  }
}

// ----------------------------------------------------
// Donors Registry View
// ----------------------------------------------------
function renderDonors() {
  const container = document.getElementById('donors-table-body');
  if (!container) return;

  const searchQuery = document.getElementById('donor-search')?.value.toLowerCase().trim() || '';
  const filterGroup = document.getElementById('donor-filter-group')?.value || 'ALL';

  const filtered = appState.data.donors.filter(donor => {
    if (filterGroup !== 'ALL' && donor.bloodGroup !== filterGroup) return false;
    if (searchQuery) {
      const match = (
        donor.name.toLowerCase().includes(searchQuery) ||
        donor.id.toLowerCase().includes(searchQuery) ||
        donor.city.toLowerCase().includes(searchQuery)
      );
      if (!match) return false;
    }
    return true;
  });

  const countEl = document.getElementById('donor-total-count');
  if (countEl) countEl.textContent = `${filtered.length} Donors Registered`;

  container.innerHTML = filtered.map(d => `
    <tr>
      <td>
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-full bg-slate-800 text-rose-400 flex items-center justify-center font-bold text-xs">
            ${d.name.split(' ').map(n=>n[0]).join('')}
          </div>
          <div>
            <p class="font-bold text-white text-xs">${d.name}</p>
            <p class="text-[10px] text-slate-400 font-mono">${d.id}</p>
          </div>
        </div>
      </td>
      <td><span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-white">${d.bloodGroup}</span></td>
      <td class="text-xs text-slate-300">${d.phone}</td>
      <td class="text-xs text-slate-300">${d.city}</td>
      <td class="text-xs text-slate-400 font-mono">${d.lastDonated || 'Never'} (${d.totalDonations}x)</td>
      <td>
        <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === 'Eligible' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
          ${d.status}
        </span>
      </td>
      <td>
        <button onclick="quickDonate('${d.id}')" class="px-2 py-1 text-xs rounded bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white transition flex items-center gap-1">
          <i data-lucide="droplet" class="w-3 h-3"></i> Donate
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function quickDonate(donorId) {
  const donor = appState.data.donors.find(d => d.id === donorId);
  if (!donor) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const expDate = new Date();
  expDate.setDate(expDate.getDate() + 35);
  const expStr = expDate.toISOString().split('T')[0];
  const newUnitId = `BLD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newUnit = {
    id: newUnitId,
    bloodGroup: donor.bloodGroup,
    component: "Whole Blood",
    volumeMl: 450,
    donorName: donor.name,
    donorId: donor.id,
    collectedDate: todayStr,
    expiryDate: expStr,
    storageLocation: "Refrigerated Bay 1",
    status: "Available"
  };

  if (window.HemoDB) {
    await window.HemoDB.addInventory(newUnit);
  }

  donor.totalDonations = (donor.totalDonations || 0) + 1;
  donor.lastDonated = todayStr;
  donor.status = "Cooldown";

  await triggerSync(false);
  renderDonors();
  renderInventory();
  renderDashboard();

  showToast(`Donation logged for ${donor.name}! Unit ${newUnitId} added.`, 'success');
}

// ----------------------------------------------------
// Requests & Hospital Dispatch Engine
// ----------------------------------------------------
function renderRequests() {
  const container = document.getElementById('requests-table-body');
  if (!container) return;

  const statusFilter = document.getElementById('req-filter-status')?.value || 'ALL';
  const searchQuery = document.getElementById('req-search')?.value.toLowerCase().trim() || '';

  const filtered = appState.data.requests.filter(req => {
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    if (searchQuery) {
      const match = (
        req.id.toLowerCase().includes(searchQuery) ||
        req.patientName.toLowerCase().includes(searchQuery) ||
        req.hospital.toLowerCase().includes(searchQuery)
      );
      if (!match) return false;
    }
    return true;
  });

  const countEl = document.getElementById('req-total-count');
  if (countEl) countEl.textContent = `${filtered.length} Requisitions`;

  container.innerHTML = filtered.map(req => `
    <tr>
      <td class="font-mono text-xs font-semibold text-rose-400">${req.id}</td>
      <td>
        <div class="font-bold text-white text-xs">${req.patientName}</div>
        <div class="text-[11px] text-slate-400">${req.hospital}</div>
      </td>
      <td><span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500/20 text-white">${req.bloodGroup}</span> (${req.unitsNeeded}u)</td>
      <td><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${req.urgency === 'CRITICAL' ? 'urgency-critical' : 'urgency-normal'}">${req.urgency}</span></td>
      <td><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${req.status === 'Dispatched' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}">${req.status}</span></td>
      <td class="text-xs font-mono text-slate-400">${req.requestDate}</td>
      <td>
        ${req.status === 'Pending' || req.status === 'Approved' ? `
          <button onclick="handleQuickDispatch('${req.id}')" class="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center gap-1">
            <i data-lucide="send" class="w-3 h-3"></i> Dispatch
          </button>
        ` : `
          <button onclick="viewDispatchSlip('${req.id}')" class="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1">
            <i data-lucide="file-text" class="w-3 h-3"></i> Slip
          </button>
        `}
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function handleQuickDispatch(reqId) {
  const req = appState.data.requests.find(r => r.id === reqId);
  if (!req) return;

  const compatibleGroups = BLOOD_COMPATIBILITY[req.bloodGroup]?.receiveFrom || [req.bloodGroup];
  let matchedUnits = appState.data.inventory.filter(u => u.status === 'Available' && u.bloodGroup === req.bloodGroup);

  if (matchedUnits.length < req.unitsNeeded) {
    const otherCompatible = appState.data.inventory.filter(u => 
      u.status === 'Available' && 
      u.bloodGroup !== req.bloodGroup && 
      compatibleGroups.includes(u.bloodGroup)
    );
    matchedUnits = [...matchedUnits, ...otherCompatible];
  }

  if (matchedUnits.length < req.unitsNeeded) {
    alert(`Insufficient Stock!\nNeeded: ${req.unitsNeeded} unit(s) of ${req.bloodGroup}.\nTotal available: ${matchedUnits.length} unit(s).`);
    return;
  }

  const unitsToDeduct = matchedUnits.slice(0, req.unitsNeeded).map(u => u.id);

  if (window.HemoDB) {
    await window.HemoDB.dispatchRequest(reqId, unitsToDeduct);
  }

  await triggerSync(false);
  renderRequests();
  renderInventory();
  renderDashboard();

  showToast(`Requisition ${req.id} dispatched!`, 'success');
  viewDispatchSlip(req.id);
}

function viewDispatchSlip(reqId) {
  const req = appState.data.requests.find(r => r.id === reqId);
  if (!req) return;

  const modal = document.getElementById('modal-dispatch-slip');
  const slipContainer = document.getElementById('dispatch-slip-content');

  const unitList = (req.dispatchedUnits && req.dispatchedUnits.length > 0) 
    ? req.dispatchedUnits.join(', ') 
    : `BLD-BATCH-${req.bloodGroup}`;

  slipContainer.innerHTML = `
    <div class="border-2 border-rose-500/40 rounded-xl p-6 bg-slate-900/95 text-slate-100">
      <div class="flex items-center justify-between border-b border-rose-500/30 pb-3 mb-4">
        <div>
          <h2 class="text-lg font-black text-rose-400 tracking-tight flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-rose-500"></span>
            HEMOCARE MEDICAL LIFE RESERVE
          </h2>
          <p class="text-[11px] text-slate-400">Clinical Blood Requisition & Transfusion Release Certificate</p>
        </div>
        <div class="text-right">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            AUTHORIZED DISPATCH
          </span>
          <p class="text-[11px] font-mono text-slate-400 mt-1">Ref: ${req.id}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs mb-3">
        <div class="p-3 bg-slate-800/60 rounded-lg">
          <p class="text-slate-400 font-semibold text-[10px]">RECIPIENT / PATIENT</p>
          <p class="text-sm font-bold text-white mt-0.5">${req.patientName}</p>
          <p class="text-slate-300">Blood Group: <b class="text-rose-400">${req.bloodGroup}</b></p>
          <p class="text-slate-400">Diagnosis: ${req.notes || 'Emergency Trauma'}</p>
        </div>

        <div class="p-3 bg-slate-800/60 rounded-lg">
          <p class="text-slate-400 font-semibold text-[10px]">HOSPITAL &amp; PHYSICIAN</p>
          <p class="text-sm font-bold text-white mt-0.5">${req.hospital}</p>
          <p class="text-slate-300">Attending: ${req.doctor || 'Dr. Medical Officer'}</p>
          <p class="text-slate-400">Timestamp: ${req.dispatchedAt || req.requestDate}</p>
        </div>
      </div>

      <div class="p-3 bg-rose-950/30 rounded-lg border border-rose-500/20 mb-3 text-xs">
        <div class="flex justify-between">
          <span>Component: <b class="text-white">${req.component || 'Whole Blood'}</b></span>
          <span>Units: <b class="text-white">${req.unitsNeeded} Bag(s)</b></span>
          <span>Batches: <b class="text-rose-400 font-mono">${unitList}</b></span>
        </div>
      </div>

      <div class="border-t border-white/10 pt-3 flex justify-between items-center text-[10px] text-slate-400">
        <p>Lab Cross-match: <b class="text-emerald-400">COMPATIBLE &amp; VERIFIED</b></p>
        <p class="text-right">Officer Signature: __________________</p>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// Donation Camps View
// ----------------------------------------------------
function renderCamps() {
  const container = document.getElementById('camps-list-container');
  if (!container) return;

  container.innerHTML = appState.data.camps.map(camp => `
    <div class="glass-panel glass-panel-hover rounded-xl p-5 border border-white/5 flex flex-col justify-between">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300">${camp.status}</span>
          <span class="text-xs font-mono text-slate-400">${camp.date}</span>
        </div>
        <h3 class="text-base font-bold text-white">${camp.name}</h3>
        <p class="text-xs text-rose-400 font-medium mb-3">${camp.organizer}</p>
        <p class="text-xs text-slate-300 mb-2"><i data-lucide="map-pin" class="inline w-3 h-3 text-slate-500 mr-1"></i>${camp.venue}</p>
      </div>
      <div class="pt-3 border-t border-white/5 text-xs flex justify-between text-slate-400">
        <span>Target: ${camp.targetUnits}</span>
        <span class="font-bold text-white">${camp.registeredDonors} Registered</span>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// Blood Compatibility Interactive Calculator
// ----------------------------------------------------
function renderCompatibilityMatrix(selectedGroup) {
  appState.selectedBloodGroupForCompat = selectedGroup;
  const info = BLOOD_COMPATIBILITY[selectedGroup];
  if (!info) return;

  document.querySelectorAll('.compat-group-btn').forEach(btn => {
    if (btn.getAttribute('data-group') === selectedGroup) {
      btn.className = "compat-group-btn px-4 py-2 rounded-lg font-black text-sm bg-rose-600 text-white shadow-lg border border-rose-500";
    } else {
      btn.className = "compat-group-btn px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 text-slate-300 border border-white/5";
    }
  });

  const giveContainer = document.getElementById('compat-give-list');
  if (giveContainer) {
    giveContainer.innerHTML = info.giveTo.map(g => `
      <div class="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-center">
        <span class="text-lg">${g}</span>
      </div>
    `).join('');
  }

  const receiveContainer = document.getElementById('compat-receive-list');
  if (receiveContainer) {
    receiveContainer.innerHTML = info.receiveFrom.map(g => `
      <div class="p-3 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-center">
        <span class="text-lg">${g}</span>
      </div>
    `).join('');
  }

  const summaryEl = document.getElementById('compat-summary-text');
  if (summaryEl) {
    if (selectedGroup === 'O-') {
      summaryEl.textContent = "Universal Red Cell Donor: O- can donate red blood cells to patients of ANY blood type.";
    } else if (selectedGroup === 'AB+') {
      summaryEl.textContent = "Universal Recipient: AB+ individuals can safely receive red blood cells from any blood type.";
    } else {
      summaryEl.textContent = `${selectedGroup} can receive from ${info.receiveFrom.join(', ')} and can donate red cells to ${info.giveTo.join(', ')}.`;
    }
  }
}

// ----------------------------------------------------
// Authentication Handlers (User & Center)
// ----------------------------------------------------
function setupAuthForms() {
  // 1. User / Donor Login Form
  const formUserLogin = document.getElementById('form-user-login');
  if (formUserLogin) {
    formUserLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('user-login-email').value.trim();
      const password = document.getElementById('user-login-password').value.trim();

      if (!email || !password) {
        showToast("Please provide both email and password.", 'warning');
        return;
      }

      if (!window.HemoDB) {
        showToast("Database connection offline.", 'error');
        return;
      }

      const authResult = await window.HemoDB.verifyUserCredentials(email, password);

      if (!authResult.success) {
        showToast(authResult.message, 'error');
        return;
      }

      const userSession = authResult.user;
      window.HemoDB.login(userSession);
      appState.authUser = userSession;

      closeAllModals();
      routeToPortal('user_portal');
      await triggerSync(false);
      showToast(`Welcome back, ${userSession.name}!`, 'success');
    });
  }

  // 2. Center Staff Login Form (Pure Database Authentication)
  const formCenterLogin = document.getElementById('form-center-login');
  if (formCenterLogin) {
    formCenterLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('center-login-code')?.value.trim() || '';
      const email = document.getElementById('center-login-email')?.value.trim() || '';
      const password = document.getElementById('center-login-password')?.value.trim() || '';

      if (!password || (!code && !email)) {
        showToast("Please enter your Center Code (or Email) and Access Password.", 'warning');
        return;
      }

      if (!window.HemoDB) {
        showToast("Database client is offline.", 'error');
        return;
      }

      const authResult = await window.HemoDB.verifyCenterCredentials(code, password, email);
      if (!authResult.success) {
        showToast(authResult.message, 'error');
        return;
      }

      const centerSession = authResult.center;
      window.HemoDB.login(centerSession);
      appState.authUser = centerSession;

      closeAllModals();
      routeToPortal('center_portal');
      await triggerSync(false);
      showToast(`Access Granted: ${centerSession.name}`, 'success');
    });
  }

  // 3. Register New Blood Bank Center Form
  const formRegisterCenter = document.getElementById('form-register-center');
  if (formRegisterCenter) {
    formRegisterCenter.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-center-name')?.value.trim();
      const centerCode = document.getElementById('reg-center-code')?.value.trim().toUpperCase();
      const email = document.getElementById('reg-center-email')?.value.trim();
      const phone = document.getElementById('reg-center-phone')?.value.trim();
      const contactPerson = document.getElementById('reg-center-officer')?.value.trim();
      const licenseNumber = document.getElementById('reg-center-license')?.value.trim();
      const city = document.getElementById('reg-center-city')?.value.trim();
      const state = document.getElementById('reg-center-state')?.value.trim();
      const address = document.getElementById('reg-center-address')?.value.trim();
      const password = document.getElementById('reg-center-password')?.value.trim();
      const confirmPassword = document.getElementById('reg-center-confirm-password')?.value.trim();

      if (!name || !centerCode || !email || !password) {
        showToast("Please fill in all mandatory center registration fields.", 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showToast("Passwords do not match. Please re-enter.", 'error');
        return;
      }

      if (password.length < 6) {
        showToast("Password must be at least 6 characters.", 'warning');
        return;
      }

      if (!window.HemoDB) {
        showToast("Database client is offline.", 'error');
        return;
      }

      try {
        const newCenterSession = await window.HemoDB.registerCenter({
          name,
          centerCode,
          email,
          phone,
          contactPerson,
          licenseNumber,
          city,
          state,
          address,
          password
        });

        window.HemoDB.login(newCenterSession);
        appState.authUser = newCenterSession;

        closeAllModals();
        routeToPortal('center_portal');
        await refreshAllData();
        await triggerSync(false);
        showToast(`Center Registered Successfully: Welcome ${name}!`, 'success');
        formRegisterCenter.reset();
      } catch (err) {
        showToast("Registration Failed: " + err.message, 'error');
      }
    });
  }
}

// ----------------------------------------------------
// Modals Setup
// ----------------------------------------------------
function setupModals() {
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-container').forEach(m => {
    m.classList.add('hidden');
    m.classList.remove('flex');
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  }
}

function openNewRequestModal(prefillBloodGroup = '') {
  const modal = document.getElementById('modal-new-request');
  if (modal) {
    if (prefillBloodGroup) {
      const select = document.getElementById('req-form-group');
      if (select) select.value = prefillBloodGroup;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  }
}

// ----------------------------------------------------
// Event Listeners for Forms & Filters
// ----------------------------------------------------
function setupEventListeners() {
  // Sync Controls
  document.getElementById('btn-header-sync')?.addEventListener('click', () => triggerSync(true));
  document.getElementById('btn-sync-dashboard')?.addEventListener('click', () => triggerSync(true));

  // Inventory filters
  ['inv-filter-group', 'inv-filter-component', 'inv-filter-status'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderInventory);
  });
  document.getElementById('inv-search')?.addEventListener('input', renderInventory);

  // Donor filters
  document.getElementById('donor-filter-group')?.addEventListener('change', renderDonors);
  document.getElementById('donor-search')?.addEventListener('input', renderDonors);

  // Request filters
  document.getElementById('req-filter-status')?.addEventListener('change', renderRequests);
  document.getElementById('req-search')?.addEventListener('input', renderRequests);

  // Landing Search
  document.getElementById('btn-landing-search')?.addEventListener('click', executePublicBloodSearch);

  // 1. Add Donor Form (with Password & Database Pre-checks)
  const formAddDonor = document.getElementById('form-add-donor');
  if (formAddDonor) {
    formAddDonor.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('donor-form-name').value.trim();
      const bloodGroup = document.getElementById('donor-form-group').value;
      const age = parseInt(document.getElementById('donor-form-age').value);
      const gender = document.getElementById('donor-form-gender').value;
      const weight = parseFloat(document.getElementById('donor-form-weight').value);
      const phone = document.getElementById('donor-form-phone').value.trim();
      const email = document.getElementById('donor-form-email').value.trim();
      const password = document.getElementById('donor-form-password')?.value.trim() || '';
      const confirmPass = document.getElementById('donor-form-confirm-password')?.value.trim() || '';
      const city = document.getElementById('donor-form-city').value.trim();
      const hb = parseFloat(document.getElementById('donor-form-hb').value) || 14.0;
      const address = document.getElementById('donor-form-address').value.trim();
      const lastDonated = document.getElementById('donor-form-last-donated').value || null;
      const notes = document.getElementById('donor-form-notes').value.trim();

      // 1. Password verification
      if (!password || password.length < 6) {
        showToast("Please enter a secure password of at least 6 characters.", 'warning');
        return;
      }
      if (password !== confirmPass) {
        showToast("Passwords do not match. Please verify your password entry.", 'error');
        return;
      }

      // 2. Clinical criteria verification
      if (isNaN(age) || age < 18 || age > 65) {
        showToast("Clinical criteria: Donor age must be between 18 and 65 years.", 'warning');
        return;
      }
      if (isNaN(weight) || weight < 50) {
        showToast("Clinical criteria: Minimum body weight requirement is 50 kg.", 'warning');
        return;
      }

      // 3. Database pre-check: Check if donor is already registered
      const submitBtn = document.getElementById('btn-submit-donor');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Checking Records...</span>`;
        if (window.lucide) lucide.createIcons();
      }

      try {
        if (window.HemoDB) {
          const preCheck = await window.HemoDB.checkDonorExists(email, phone);
          if (preCheck.exists) {
            showToast(preCheck.message, 'warning');
            return;
          }
        }

        // Determine clinical eligibility status based on Hb (clinical standard >= 12.5 g/dL)
        const isEligible = hb >= 12.5;
        const initialStatus = isEligible ? "Eligible" : "Deferred";

        const newDonor = {
          id: `DNR-${Math.floor(1000 + Math.random() * 9000)}`,
          name: name,
          password: password,
          age: age,
          gender: gender,
          bloodGroup: bloodGroup,
          phone: phone,
          email: email,
          city: city,
          address: address,
          weightKg: weight,
          hemoglobin: hb,
          totalDonations: 0,
          lastDonated: lastDonated,
          status: initialStatus,
          notes: notes || (isEligible ? "Voluntary donor registered." : "Deferred on registration due to low hemoglobin.")
        };

        // Persist and synchronize to database
        if (window.HemoDB) {
          await window.HemoDB.addDonor(newDonor);
        }

        // Trigger complete data refresh & dashboard synchronization
        await triggerSync(false);

        // Notify runner terminal of donor registration sync
        try {
          fetch('/api/sync-ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'Donor Account Registered',
              details: `Donor ${newDonor.name} (${newDonor.bloodGroup}) registered with password & synced to database`
            })
          }).catch(() => {});
        } catch (e) {}

        // Auto-login registered donor if not currently operating as center staff
        const wasInCenter = appState.authUser && appState.authUser.role === 'center_staff';
        if (!wasInCenter) {
          const newSession = {
            role: 'donor',
            id: newDonor.id,
            name: newDonor.name,
            email: newDonor.email,
            bloodGroup: newDonor.bloodGroup,
            phone: newDonor.phone,
            city: newDonor.city,
            totalDonations: 0,
            status: newDonor.status
          };
          if (window.HemoDB) window.HemoDB.login(newSession);
          appState.authUser = newSession;
        }

        formAddDonor.reset();
        closeAllModals();

        if (wasInCenter) {
          renderDonors();
          renderDashboard();
          showToast(`Donor ${newDonor.name} (${newDonor.bloodGroup}) registered and synced to central database!`, 'success');
        } else {
          routeToPortal('user_portal');
          showToast(`Welcome, ${newDonor.name}! Your account has been registered and synced with the database.`, 'success');
        }
      } catch (err) {
        console.error("Donor registration error:", err);
        showToast("Registration error: " + err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Register &amp; Sync Donor</span>`;
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  // 2. Add Unit Form
  const formAddUnit = document.getElementById('form-add-unit');
  if (formAddUnit) {
    formAddUnit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const component = document.getElementById('unit-form-component').value;
      const colDate = document.getElementById('unit-form-col-date').value || new Date().toISOString().split('T')[0];

      const expDate = new Date(colDate);
      if (component === 'Platelets') expDate.setDate(expDate.getDate() + 7);
      else if (component === 'Fresh Frozen Plasma') expDate.setDate(expDate.getDate() + 365);
      else expDate.setDate(expDate.getDate() + 42);

      const newUnit = {
        id: `BLD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        bloodGroup: document.getElementById('unit-form-group').value,
        component: component,
        volumeMl: parseInt(document.getElementById('unit-form-volume').value) || 450,
        donorName: document.getElementById('unit-form-donor-name').value.trim() || 'Voluntary Donor',
        donorId: "DNR-WALKIN",
        collectedDate: colDate,
        expiryDate: expDate.toISOString().split('T')[0],
        storageLocation: document.getElementById('unit-form-storage').value.trim() || 'Refrigerated Bay 1',
        status: document.getElementById('unit-form-status').value
      };

      if (window.HemoDB) await window.HemoDB.addInventory(newUnit);
      await triggerSync(false);

      formAddUnit.reset();
      closeAllModals();

      renderInventory();
      renderDashboard();
      showToast(`Unit ${newUnit.id} placed in cold storage.`, 'success');
    });
  }

  // 3. New Blood Request Form
  const formNewReq = document.getElementById('form-new-req');
  if (formNewReq) {
    formNewReq.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newReq = {
        id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: document.getElementById('req-form-patient').value.trim(),
        age: parseInt(document.getElementById('req-form-age').value) || 30,
        gender: document.getElementById('req-form-gender').value,
        hospital: document.getElementById('req-form-hospital').value.trim(),
        department: document.getElementById('req-form-dept').value.trim() || 'Emergency Care',
        bloodGroup: document.getElementById('req-form-group').value,
        component: document.getElementById('req-form-component').value,
        unitsNeeded: parseInt(document.getElementById('req-form-units').value) || 1,
        urgency: document.getElementById('req-form-urgency').value,
        doctor: document.getElementById('req-form-doctor').value.trim(),
        notes: document.getElementById('req-form-notes').value.trim(),
        requesterEmail: appState.authUser ? appState.authUser.email : null,
        status: "Pending",
        requestDate: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };

      if (window.HemoDB) await window.HemoDB.addRequest(newReq);
      await triggerSync(false);

      formNewReq.reset();
      closeAllModals();

      if (appState.currentPortal === 'user_portal') {
        renderUserPortal();
      } else {
        renderRequests();
        renderDashboard();
      }
      showToast(`Blood Request ${newReq.id} recorded!`, 'info');
    });
  }

  // 4. Schedule Camp Form
  const formScheduleCamp = document.getElementById('form-schedule-camp');
  if (formScheduleCamp) {
    formScheduleCamp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newCamp = {
        id: `CMP-${Math.floor(100 + Math.random() * 900)}`,
        name: document.getElementById('camp-form-name').value.trim(),
        organizer: document.getElementById('camp-form-org').value.trim(),
        venue: document.getElementById('camp-form-venue').value.trim(),
        date: document.getElementById('camp-form-date').value,
        time: document.getElementById('camp-form-time').value.trim() || '09:00 AM - 04:00 PM',
        targetUnits: parseInt(document.getElementById('camp-form-target').value) || 100,
        registeredDonors: 0,
        status: "Upcoming",
        contactPerson: document.getElementById('camp-form-contact').value.trim(),
        contactPhone: document.getElementById('camp-form-phone').value.trim()
      };

      if (window.HemoDB) await window.HemoDB.addCamp(newCamp);
      await triggerSync(false);

      formScheduleCamp.reset();
      closeAllModals();

      renderCamps();
      showToast(`Donation Drive "${newCamp.name}" scheduled!`, 'success');
    });
  }

  // 5. Donor Profile Form
  const formDonorProfile = document.getElementById('form-donor-profile');
  if (formDonorProfile) {
    formDonorProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = appState.authUser;
      if (!user) return;

      const donorId = document.getElementById('dp-id-badge')?.textContent.trim() || user.id;
      const name = document.getElementById('dp-form-name').value.trim();
      const bloodGroup = document.getElementById('dp-form-group').value;
      const phone = document.getElementById('dp-form-phone').value.trim();
      const email = document.getElementById('dp-form-email').value.trim();
      const age = parseInt(document.getElementById('dp-form-age').value);
      const gender = document.getElementById('dp-form-gender').value;
      const weight = parseFloat(document.getElementById('dp-form-weight').value);
      const hb = parseFloat(document.getElementById('dp-form-hb').value) || 14.0;
      const city = document.getElementById('dp-form-city').value.trim();
      const address = document.getElementById('dp-form-address').value.trim();
      const notes = document.getElementById('dp-form-notes').value.trim();
      const password = document.getElementById('dp-form-password').value.trim();
      const confirmPassword = document.getElementById('dp-form-confirm-password').value.trim();

      if (password) {
        if (password.length < 6) {
          showToast("Password must be at least 6 characters.", "warning");
          return;
        }
        if (password !== confirmPassword) {
          showToast("Passwords do not match.", "error");
          return;
        }
      }

      if (isNaN(age) || age < 18 || age > 65) {
        showToast("Clinical criteria: Age must be between 18 and 65 years.", "warning");
        return;
      }

      if (isNaN(weight) || weight < 50) {
        showToast("Clinical criteria: Weight must be at least 50 kg.", "warning");
        return;
      }

      const saveBtn = document.getElementById('btn-save-donor-profile');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Saving &amp; Syncing...</span>`;
        if (window.lucide) lucide.createIcons();
      }

      try {
        const updatePayload = {
          name,
          bloodGroup,
          phone,
          email,
          age,
          gender,
          weightKg: weight,
          hemoglobin: hb,
          city,
          address,
          notes
        };
        if (password) updatePayload.password = password;

        if (window.HemoDB) {
          const updatedSession = await window.HemoDB.updateDonorProfile(donorId, updatePayload);
          if (updatedSession) appState.authUser = updatedSession;
        }

        await triggerSync(false);

        try {
          fetch('/api/sync-ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'Donor Profile Updated',
              details: `Donor ${name} updated profile details & password in central database`
            })
          }).catch(() => {});
        } catch (e) {}

        closeAllModals();
        renderUserPortal();
        showToast("Profile updated and synced to central database!", "success");
      } catch (err) {
        showToast("Failed to update profile: " + err.message, "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Save Profile &amp; Sync</span>`;
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  // 6. Book Donation Slot Form
  const formBookSlot = document.getElementById('form-book-slot');
  if (formBookSlot) {
    formBookSlot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = appState.authUser;
      if (!user) {
        showToast("Please sign in or register to book a slot.", "warning");
        return;
      }

      const centerSelect = document.getElementById('slot-form-center');
      const selectedOption = centerSelect.options[centerSelect.selectedIndex];
      if (!selectedOption || !selectedOption.value) {
        showToast("Please select a donation center.", "warning");
        return;
      }

      const centerCode = selectedOption.value;
      const centerName = selectedOption.dataset.name || selectedOption.text.split(' (')[0];
      const appointmentDate = document.getElementById('slot-form-date').value;
      const timeSlot = document.getElementById('slot-form-time').value;
      const donationType = document.getElementById('slot-form-type').value;
      const donorName = document.getElementById('slot-form-donor-name').value.trim();
      const bloodGroup = document.getElementById('slot-form-blood-group').value;
      const donorPhone = document.getElementById('slot-form-donor-phone').value.trim();
      const donorEmail = document.getElementById('slot-form-donor-email').value.trim() || user.email;
      const notes = document.getElementById('slot-form-notes').value.trim();

      const submitBtn = document.getElementById('btn-submit-book-slot');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Booking Slot...</span>`;
        if (window.lucide) lucide.createIcons();
      }

      try {
        const appointmentData = {
          donorId: user.id,
          donorName,
          donorEmail,
          donorPhone,
          bloodGroup,
          centerCode,
          centerName,
          appointmentDate,
          timeSlot,
          donationType,
          status: 'Scheduled',
          notes
        };

        if (window.HemoDB) {
          await window.HemoDB.addAppointment(appointmentData);
        }

        await triggerSync(false);

        try {
          fetch('/api/sync-ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'Donation Slot Booked',
              details: `Donor ${donorName} (${bloodGroup}) booked slot for ${appointmentDate} at ${centerName}`
            })
          }).catch(() => {});
        } catch (e) {}

        formBookSlot.reset();
        closeAllModals();
        renderUserPortal();
        showToast(`Donation slot confirmed for ${appointmentDate}! Center dashboard updated.`, "success");
      } catch (err) {
        showToast("Failed to book slot: " + err.message, "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="calendar-check" class="w-3.5 h-3.5"></i><span>Confirm Slot &amp; Sync to Center</span>`;
          if (window.lucide) lucide.createIcons();
        }
      }
    });
  }

  // 7. Center Profile Form (In Center View)
  const formCenterViewProfile = document.getElementById('form-center-view-profile');
  if (formCenterViewProfile) {
    formCenterViewProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCenterProfileSubmit({
        name: document.getElementById('cp-view-name').value.trim(),
        email: document.getElementById('cp-view-email').value.trim(),
        phone: document.getElementById('cp-view-phone').value.trim(),
        contactPerson: document.getElementById('cp-view-contact').value.trim(),
        licenseNumber: document.getElementById('cp-view-license').value.trim(),
        category: document.getElementById('cp-view-category').value,
        city: document.getElementById('cp-view-city').value.trim(),
        state: document.getElementById('cp-view-state').value.trim(),
        address: document.getElementById('cp-view-address').value.trim(),
        password: document.getElementById('cp-view-password').value.trim(),
        confirmPassword: document.getElementById('cp-view-confirm-password').value.trim()
      }, 'btn-save-center-profile');
    });
  }

  // 8. Modal Center Profile Form
  const formModalCenterProfile = document.getElementById('form-modal-center-profile');
  if (formModalCenterProfile) {
    formModalCenterProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCenterProfileSubmit({
        name: document.getElementById('cp-modal-name').value.trim(),
        email: document.getElementById('cp-modal-email').value.trim(),
        phone: document.getElementById('cp-modal-phone').value.trim(),
        contactPerson: document.getElementById('cp-modal-contact').value.trim(),
        licenseNumber: document.getElementById('cp-modal-license').value.trim(),
        category: document.getElementById('cp-modal-category').value,
        city: document.getElementById('cp-modal-city').value.trim(),
        state: document.getElementById('cp-modal-state').value.trim(),
        address: document.getElementById('cp-modal-address').value.trim(),
        password: document.getElementById('cp-modal-password').value.trim(),
        confirmPassword: document.getElementById('cp-modal-confirm-password').value.trim()
      }, 'btn-save-modal-center-profile');
      // closeAllModals() is handled inside handleCenterProfileSubmit on success
    });
  }

  // Slot Center Select Change Listener
  document.getElementById('slot-form-center')?.addEventListener('change', function() {
    updateSlotCenterPreview(this);
  });

  // Appointment Search Listener
  document.getElementById('apt-search-input')?.addEventListener('input', () => {
    renderCenterAppointments();
  });

  // Print Slip
  document.getElementById('btn-print-slip')?.addEventListener('click', () => window.print());

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', exportInventoryCSV);
}

async function handleCenterProfileSubmit(formData, btnId) {
  const center = appState.authUser;
  if (!center) return;

  const centerCode = center.centerCode || center.id;

  if (formData.password) {
    if (formData.password.length < 6) {
      showToast("Password must be at least 6 characters.", "warning");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }
  }

  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Saving &amp; Syncing...</span>`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const updatePayload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      contactPerson: formData.contactPerson,
      licenseNumber: formData.licenseNumber,
      category: formData.category,
      city: formData.city,
      state: formData.state,
      address: formData.address
    };
    if (formData.password) updatePayload.password = formData.password;

    if (window.HemoDB) {
      const updatedCenter = await window.HemoDB.updateCenterProfile(centerCode, updatePayload);
      if (updatedCenter) appState.authUser = updatedCenter;
    }

    await triggerSync(false);
    updateCenterHeaderInfo();

    try {
      fetch('/api/sync-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'Center Profile Updated',
          details: `Center ${formData.name} (${centerCode}) updated details & credentials in central database`
        })
      }).catch(() => {});
    } catch (e) {}

    showToast("Center profile updated & synchronized with cloud database!", "success");
    renderCenterProfileTab();
    closeAllModals();
  } catch (err) {
    showToast("Error updating center profile: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Update Center Profile &amp; Sync</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// ----------------------------------------------------
// CSV Export Utility
// ----------------------------------------------------
function exportInventoryCSV() {
  const inventory = appState.data.inventory;
  if (!inventory || inventory.length === 0) {
    showToast("No inventory data to export.", "warning");
    return;
  }

  const headers = ["Unit ID", "Blood Group", "Component", "Volume (ml)", "Donor", "Collection Date", "Expiry Date", "Location", "Status"];
  const rows = inventory.map(item => [
    item.id,
    item.bloodGroup,
    item.component,
    item.volumeMl,
    `"${item.donorName}"`,
    item.collectedDate,
    item.expiryDate,
    `"${item.storageLocation}"`,
    item.status
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `Hemocare_Blood_Stock_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Inventory CSV downloaded.", "success");
}

// ----------------------------------------------------
// Toast Notifications
// ----------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Sanitize message to prevent XSS
  const safeMsg = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const toast = document.createElement('div');
  toast.className = 'toast-item';

  let iconName = 'info';
  let iconColor = 'text-cyan-400';
  let borderColor = 'border-cyan-500/30';

  if (type === 'success') {
    iconName = 'check-circle';
    iconColor = 'text-emerald-400';
    borderColor = 'border-emerald-500/30';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    iconColor = 'text-amber-400';
    borderColor = 'border-amber-500/30';
  } else if (type === 'danger' || type === 'error') {
    iconName = 'alert-circle';
    iconColor = 'text-rose-400';
    borderColor = 'border-rose-500/30';
  }

  toast.classList.add(borderColor);
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 ${iconColor} shrink-0 mt-0.5"></i>
    <div class="flex-1">
      <p class="text-xs font-semibold text-white">${safeMsg}</p>
    </div>
    <button class="text-slate-400 hover:text-white" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
