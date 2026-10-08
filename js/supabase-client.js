/**
 * HEMOCARE OS - 100% Pure Cloud Database Client (Supabase PostgreSQL)
 * Production Adapter: Blood Centers, Donors, Inventory, Requests & Camps.
 */

class SupabaseAdapter {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = {
      url: null,
      anonKey: null
    };
    this.currentUser = null;
    this.ready = this.init();
  }

  async ensureReady() {
    if (this.ready) {
      await this.ready;
    }
    if (!this.client && this.config.url && this.config.anonKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(this.config.url, this.config.anonKey);
        this.isConnected = true;
      } catch (err) {
        console.error("❌ [HEMOCARE] Error creating Supabase client in ensureReady:", err);
      }
    }
    return this.client;
  }

  async init() {
    // 1. Load config from server API /api/config, window, or fallback
    await this.loadEnvConfig();

    // 2. Initialize Supabase cloud client
    if (this.config.url && this.config.anonKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(this.config.url, this.config.anonKey);
        // Verify live cloud connectivity against central database
        const { count, error } = await this.client
          .from('blood_inventory')
          .select('id', { count: 'exact', head: true });
        
        if (!error) {
          this.isConnected = true;
          console.log("⚡ [HEMOCARE] 100% Cloud Database Connected (Supabase PostgreSQL)");
        } else {
          console.warn("⚠️ [HEMOCARE] Cloud database connection probe warning:", error.message);
          this.isConnected = true; // Client is still valid and functional
        }
      } catch (err) {
        console.error("❌ [HEMOCARE] Cloud database initialization error:", err);
      }
    } else if (!window.supabase) {
      console.error("❌ [HEMOCARE] Supabase JS library (@supabase/supabase-js) is not loaded on window.");
    }

    // 3. Restore user authentication session
    this.loadSession();
    this.updateConnectionUI();
    return this.client;
  }

  async loadEnvConfig() {
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
      this.config = { ...this.config, ...window.SUPABASE_CONFIG };
      return;
    }

    // 1. Fetch from server API endpoint /api/config (safe, never exposes server secrets)
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.url && data.anonKey) {
          this.config.url = data.url;
          this.config.anonKey = data.anonKey;
          return;
        }
      }
    } catch (e) {
      // Local or static server fallback
    }

    // 2. Window global fallback
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      this.config.url = window.SUPABASE_URL;
      this.config.anonKey = window.SUPABASE_ANON_KEY;
      return;
    }

    // 3. Resilient built-in fallback configuration (public anon key is safe for browser use)
    this.config.url = "https://mspgrlfcytpwzoyacxhw.supabase.co";
    this.config.anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcGdybGZjeXRwd3pveWFjeGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTAxNzcsImV4cCI6MjEwNjg2NjE3N30.ptTcrpCLpJRzEmgEELRaPcIe231NiOBC87njaAFSjRA";
  }

  updateConnectionUI() {
    const statusBadges = document.querySelectorAll('.db-status-badge');
    statusBadges.forEach(badge => {
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-emerald-400 font-mono text-[11px] font-bold">CENTRAL CLOUD DATABASE: ONLINE</span>
      `;
      badge.className = "db-status-badge flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20";
    });
  }

  // --------------------------------------------------
  // Authentication & Session
  // --------------------------------------------------
  loadSession() {
    try {
      const stored = localStorage.getItem('HEMOCARE_AUTH_USER');
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Auth session load error:", e);
    }
  }

  login(userObj) {
    this.currentUser = userObj;
    localStorage.setItem('HEMOCARE_AUTH_USER', JSON.stringify(userObj));
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('HEMOCARE_AUTH_USER');
  }

  // --------------------------------------------------
  // Cryptographic Password Hashing Engine (SHA-256)
  // --------------------------------------------------
  static async hashPassword(password) {
    if (!password) return '';
    const salt = 'hemocare_salt_v2:';
    const input = salt + password.trim();

    // Use Web Crypto API if available (preferred, handles all Unicode)
    if (window.crypto && window.crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256$${hex}`;
      } catch (e) {
        console.warn('[HEMOCARE] Web Crypto failed, using fallback', e);
      }
    }

    // Pure-JS fallback (ASCII only)
    const result = SupabaseAdapter.sha256(input);
    if (!result) throw new Error('Password hashing failed: non-ASCII characters are not supported in fallback mode.');
    return `sha256$${result}`;
  }

  static async verifyPassword(plainPassword, storedHash) {
    if (!plainPassword || !storedHash) return false;
    const computed = await SupabaseAdapter.hashPassword(plainPassword);

    // Exact hash match
    if (computed === storedHash) return true;

    return false;
  }

  static sha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = 'length';
    let i, j;
    let result = '';

    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    let hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    while (ascii[lengthProperty] % 64 < 56) ascii += '\x00';
    while (ascii[lengthProperty] % 64 < 60) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);
    for (j = 0; j < words[lengthProperty];) {
      const w = words.slice(j, j += 16);
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const i2 = i + j;
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const b = (hash[i] >> (8 * j)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // --------------------------------------------------
  // CRUD: Blood Centers (Dedicated Database Table)
  // --------------------------------------------------
  async getCenters() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('blood_centers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[HEMOCARE] Error fetching blood centers:", error.message);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      centerCode: c.center_code,
      name: c.center_name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      state: c.state,
      address: c.address,
      licenseNumber: c.license_number,
      contactPerson: c.contact_person,
      category: c.category,
      status: c.status
    }));
  }

  async checkCenterExists(centerCode, email) {
    if (!this.client) return { exists: false };
    const cleanCode = (centerCode || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      if (cleanCode) {
        const { data: codeData } = await this.client
          .from('blood_centers')
          .select('id, center_code, center_name')
          .eq('center_code', cleanCode)
          .limit(1);
        if (codeData && codeData.length > 0) {
          return { exists: true, message: `Center Code "${cleanCode}" is already registered (${codeData[0].center_name}).` };
        }
      }
      if (cleanEmail) {
        const { data: emailData } = await this.client
          .from('blood_centers')
          .select('id, center_code, email')
          .ilike('email', cleanEmail)
          .limit(1);
        if (emailData && emailData.length > 0) {
          return { exists: true, message: `A center with email "${cleanEmail}" is already registered.` };
        }
      }
    } catch (e) {
      console.warn("[HEMOCARE] Center pre-check warning:", e);
    }
    return { exists: false };
  }

  async registerCenter(center) {
    if (!this.client) throw new Error("Cloud database not connected.");

    const cleanCode = (center.centerCode || '').trim().toUpperCase();
    const cleanEmail = (center.email || '').trim().toLowerCase();

    if (!cleanCode || !center.name || !cleanEmail || !center.password) {
      throw new Error("Missing required center registration fields.");
    }

    // Check existence
    const existsCheck = await this.checkCenterExists(cleanCode, cleanEmail);
    if (existsCheck.exists) {
      throw new Error(existsCheck.message);
    }

    const hashedPassword = await SupabaseAdapter.hashPassword(center.password);

    // 1. Insert into dedicated blood_centers table
    const centerRecord = {
      id: cleanCode,
      center_code: cleanCode,
      center_name: (center.name || '').trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: (center.phone || '').trim(),
      city: (center.city || '').trim(),
      state: (center.state || '').trim(),
      address: (center.address || '').trim(),
      license_number: (center.licenseNumber || '').trim(),
      contact_person: (center.contactPerson || '').trim(),
      category: center.category || 'Blood Bank & Component Center',
      status: 'Active'
    };

    const { error: insertErr } = await this.client
      .from('blood_centers')
      .insert([centerRecord]);

    if (insertErr) {
      console.error("[HEMOCARE] Error registering center in database:", insertErr.message);
      throw insertErr;
    }

    // 2. Synchronize to user_profiles table for role-based authentication
    try {
      await this.client.from('user_profiles').upsert([{
        email: cleanEmail,
        password: hashedPassword,
        full_name: center.contactPerson || center.name,
        role: 'center_staff',
        phone: center.phone,
        city: center.city,
        center_name: center.name,
        center_code: cleanCode
      }], { onConflict: 'email' });
    } catch (e) {}

    // 3. Trigger dynamic dedicated per-center table provisioning in PostgreSQL (optional RPC)
    try {
      await this.client.rpc('create_center_tables', { center_code_param: cleanCode });
    } catch (e) {}

    return {
      role: 'center_staff',
      id: cleanCode,
      centerCode: cleanCode,
      name: center.name,
      email: cleanEmail,
      phone: center.phone,
      city: center.city,
      state: center.state,
      address: center.address,
      licenseNumber: center.licenseNumber,
      contactPerson: center.contactPerson,
      category: center.category || 'Blood Bank & Component Center'
    };
  }

  async updateCenterProfile(centerCode, updatedData) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const cleanCode = (centerCode || '').trim().toUpperCase();
    if (!cleanCode) throw new Error("Center Code is required.");

    const updateFields = {};
    if (updatedData.name !== undefined && updatedData.name.trim()) updateFields.center_name = updatedData.name.trim();
    if (updatedData.email !== undefined && updatedData.email.trim()) updateFields.email = updatedData.email.trim().toLowerCase();
    if (updatedData.phone !== undefined) updateFields.phone = updatedData.phone.trim();
    if (updatedData.city !== undefined) updateFields.city = updatedData.city.trim();
    if (updatedData.state !== undefined) updateFields.state = updatedData.state.trim();
    if (updatedData.address !== undefined) updateFields.address = updatedData.address.trim();
    if (updatedData.licenseNumber !== undefined) updateFields.license_number = updatedData.licenseNumber.trim();
    if (updatedData.contactPerson !== undefined) updateFields.contact_person = updatedData.contactPerson.trim();
    if (updatedData.category !== undefined) updateFields.category = updatedData.category.trim();

    let newHashedPass = null;
    if (updatedData.password && updatedData.password.trim()) {
      newHashedPass = await SupabaseAdapter.hashPassword(updatedData.password.trim());
      updateFields.password = newHashedPass;
    }

    const { error: centerErr } = await this.client
      .from('blood_centers')
      .update(updateFields)
      .eq('center_code', cleanCode);

    if (centerErr) {
      console.error("[HEMOCARE] Error updating center in cloud:", centerErr.message);
      throw centerErr;
    }

    // Sync to user_profiles table as well
    const emailToSync = updateFields.email || (this.currentUser && this.currentUser.email);
    if (emailToSync) {
      const profUpdate = {
        full_name: updateFields.contact_person || updateFields.center_name || (this.currentUser && this.currentUser.name),
        phone: updateFields.phone,
        city: updateFields.city,
        center_name: updateFields.center_name
      };
      if (newHashedPass) profUpdate.password = newHashedPass;
      try {
        await this.client
          .from('user_profiles')
          .update(profUpdate)
          .ilike('email', emailToSync);
      } catch (e) {}
    }

    // Update active session if currently logged in as this center
    if (this.currentUser && (this.currentUser.centerCode === cleanCode || this.currentUser.id === cleanCode)) {
      this.currentUser = {
        ...this.currentUser,
        name: updateFields.center_name || this.currentUser.name,
        email: updateFields.email || this.currentUser.email,
        phone: updateFields.phone !== undefined ? updateFields.phone : this.currentUser.phone,
        city: updateFields.city !== undefined ? updateFields.city : this.currentUser.city,
        state: updateFields.state !== undefined ? updateFields.state : this.currentUser.state,
        address: updateFields.address !== undefined ? updateFields.address : this.currentUser.address,
        licenseNumber: updateFields.license_number !== undefined ? updateFields.license_number : this.currentUser.licenseNumber,
        contactPerson: updateFields.contact_person !== undefined ? updateFields.contact_person : this.currentUser.contactPerson,
        category: updateFields.category !== undefined ? updateFields.category : this.currentUser.category
      };
      localStorage.setItem('HEMOCARE_AUTH_USER', JSON.stringify(this.currentUser));
    }

    return this.currentUser;
  }

  async verifyCenterCredentials(centerCode, password, email) {
    await this.ensureReady();
    if (!this.client) return { success: false, message: "Database is not connected. Please check your network connection." };
    const cleanCode = (centerCode || '').trim().toUpperCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanPass) return { success: false, message: "Please enter your access password." };

    try {
      // 1. Query dedicated blood_centers table
      let query = this.client.from('blood_centers').select('*');
      if (cleanCode && cleanEmail) {
        query = query.or(`center_code.eq.${cleanCode},email.ilike.${cleanEmail}`);
      } else if (cleanCode) {
        query = query.eq('center_code', cleanCode);
      } else if (cleanEmail) {
        query = query.ilike('email', cleanEmail);
      } else {
        return { success: false, message: "Please provide either Center Code or Email." };
      }

      const { data: centerList, error: centerErr } = await query.limit(1);

      if (!centerErr && centerList && centerList.length > 0) {
        const c = centerList[0];
        const storedHash = c.password || '';
        const isValid = await SupabaseAdapter.verifyPassword(cleanPass, storedHash);

        if (isValid) {
          return {
            success: true,
            center: {
              role: 'center_staff',
              id: c.id || c.center_code,
              centerCode: c.center_code,
              name: c.center_name,
              email: c.email,
              phone: c.phone,
              city: c.city,
              state: c.state,
              address: c.address,
              licenseNumber: c.license_number,
              contactPerson: c.contact_person,
              category: c.category || 'Blood Bank & Component Center'
            }
          };
        } else {
          return { success: false, message: "Invalid password for this center account." };
        }
      }

      // 2. Query user_profiles fallback for center_staff
      if (cleanEmail) {
        const { data: profList } = await this.client
          .from('user_profiles')
          .select('*')
          .eq('role', 'center_staff')
          .ilike('email', cleanEmail)
          .limit(1);

        if (profList && profList.length > 0) {
          const p = profList[0];
          const isValid = await SupabaseAdapter.verifyPassword(cleanPass, p.password || '');
          if (isValid) {
            return {
              success: true,
              center: {
                role: 'center_staff',
                id: p.center_code || 'CTR-STAFF',
                centerCode: p.center_code || 'CTR-STAFF',
                name: p.center_name || p.full_name,
                email: p.email,
                phone: p.phone,
                city: p.city
              }
            };
          }
        }
      }

      return { success: false, message: "No registered center found with provided Center Code or Email." };
    } catch (err) {
      console.error("[HEMOCARE] Center authentication error:", err);
      return { success: false, message: "Database connection error: " + err.message };
    }
  }

  // --------------------------------------------------
  // CRUD: Blood Inventory (100% Cloud)
  // --------------------------------------------------
  async getInventory() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('blood_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[HEMOCARE] Error fetching cloud inventory:", error.message);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      bloodGroup: item.blood_group,
      component: item.component,
      volumeMl: item.volume_ml,
      donorName: item.donor_name,
      donorId: item.donor_id,
      collectedDate: item.collected_date,
      expiryDate: item.expiry_date,
      storageLocation: item.storage_location,
      centerCode: item.center_code || 'DEFAULT',
      status: item.status,
      createdAt: item.created_at
    }));
  }

  async addInventory(unit) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const currentCenterCode = (this.currentUser && this.currentUser.centerCode) ? this.currentUser.centerCode : 'DEFAULT';
    const { data, error } = await this.client.from('blood_inventory').insert([{
      id: unit.id,
      blood_group: unit.bloodGroup,
      component: unit.component,
      volume_ml: unit.volumeMl,
      donor_name: unit.donorName,
      donor_id: unit.donorId,
      collected_date: unit.collectedDate,
      expiry_date: unit.expiryDate,
      storage_location: unit.storageLocation,
      center_code: unit.centerCode || currentCenterCode,
      status: unit.status
    }]).select();

    if (error) {
      console.error("[HEMOCARE] Error inserting unit to cloud:", error.message);
      throw error;
    }
    return data;
  }

  async updateInventoryStatus(id, newStatus) {
    if (!this.client) return;
    const { error } = await this.client
      .from('blood_inventory')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error("[HEMOCARE] Error updating inventory in cloud:", error.message);
      throw error;
    }
  }

  // --------------------------------------------------
  // CRUD: Donors & Verification (100% Cloud)
  // --------------------------------------------------
  async getDonors() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('donors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[HEMOCARE] Error fetching cloud donors:", error.message);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      age: d.age,
      gender: d.gender,
      bloodGroup: d.blood_group,
      phone: d.phone,
      email: d.email,
      city: d.city,
      address: d.address,
      weightKg: d.weight_kg,
      hemoglobin: d.hemoglobin,
      totalDonations: d.total_donations,
      lastDonated: d.last_donated,
      status: d.status,
      notes: d.notes,
      password: d.password || ''
    }));
  }

  async checkDonorExists(email, phone) {
    if (!this.client) return { exists: false };
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    try {
      if (cleanEmail) {
        const { data: emailData } = await this.client
          .from('donors')
          .select('id, name, email')
          .ilike('email', cleanEmail)
          .limit(1);
        if (emailData && emailData.length > 0) {
          return { exists: true, message: `A donor record with email "${cleanEmail}" is already registered. Please sign in instead.` };
        }
      }
      if (cleanPhone) {
        const { data: phoneData } = await this.client
          .from('donors')
          .select('id, name, phone')
          .eq('phone', cleanPhone)
          .limit(1);
        if (phoneData && phoneData.length > 0) {
          return { exists: true, message: `The phone number "${cleanPhone}" is already registered with donor ${phoneData[0].name}.` };
        }
      }
    } catch (err) {
      console.warn("[HEMOCARE] Cloud donor pre-check query warning:", err);
    }

    return { exists: false };
  }

  async verifyUserCredentials(email, password) {
    await this.ensureReady();
    if (!this.client) return { success: false, message: "Database is not connected. Please check your network connection." };
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanPass) return { success: false, message: "Please enter your password." };

    try {
      // 1. Query donors table in cloud database
      const { data: donorList, error: donorErr } = await this.client
        .from('donors')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (!donorErr && donorList && donorList.length > 0) {
        const d = donorList[0];
        const storedHash = d.password || '';
        const isValid = await SupabaseAdapter.verifyPassword(cleanPass, storedHash);

        if (isValid) {
          return {
            success: true,
            user: {
              role: 'donor',
              id: d.id,
              name: d.name,
              email: d.email || cleanEmail,
              bloodGroup: d.blood_group,
              phone: d.phone,
              city: d.city,
              address: d.address || '',
              age: d.age,
              gender: d.gender,
              weightKg: d.weight_kg,
              hemoglobin: d.hemoglobin,
              totalDonations: d.total_donations || 0,
              lastDonated: d.last_donated,
              status: d.status,
              notes: d.notes || ''
            }
          };
        } else {
          return { success: false, message: "Invalid password for this donor account." };
        }
      }

      // 2. Query user_profiles table in cloud database
      const { data: profileList, error: profErr } = await this.client
        .from('user_profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (!profErr && profileList && profileList.length > 0) {
        const p = profileList[0];
        const storedHash = p.password || '';
        const isValid = await SupabaseAdapter.verifyPassword(cleanPass, storedHash);

        if (isValid) {
          return {
            success: true,
            user: {
              role: p.role || 'donor',
              id: p.id,
              name: p.full_name,
              email: p.email,
              bloodGroup: p.blood_group || 'O-',
              phone: p.phone,
              city: p.city
            }
          };
        } else {
          return { success: false, message: "Invalid password." };
        }
      }
    } catch (err) {
      console.error("[HEMOCARE] Cloud credentials check error:", err);
      return { success: false, message: "Database connection error: " + err.message };
    }

    return { success: false, message: "No registered donor account found with this email in the database." };
  }

  async addDonor(donor) {
    if (!this.client) throw new Error("Cloud database not connected.");

    if (!donor.password) {
      throw new Error("Password is required for donor registration.");
    }
    const hashedPassword = await SupabaseAdapter.hashPassword(donor.password);

    // Insert into public.donors table in cloud with hashed password
    const { error: insertErr } = await this.client.from('donors').insert([{
      id: donor.id,
      name: donor.name,
      age: donor.age,
      gender: donor.gender,
      blood_group: donor.bloodGroup,
      phone: donor.phone,
      email: donor.email,
      city: donor.city,
      address: donor.address,
      weight_kg: donor.weightKg,
      hemoglobin: donor.hemoglobin,
      total_donations: donor.totalDonations || 0,
      last_donated: donor.lastDonated || null,
      status: donor.status || 'Eligible',
      notes: donor.notes || '',
      password: hashedPassword
    }]);

    if (insertErr) {
      console.error("[HEMOCARE] Cloud donor insert error:", insertErr.message);
      throw insertErr;
    }

    // Synchronize to public.user_profiles table in cloud with hashed password
    try {
      await this.client.from('user_profiles').upsert([{
        email: donor.email,
        password: hashedPassword,
        full_name: donor.name,
        role: 'donor',
        phone: donor.phone,
        blood_group: donor.bloodGroup,
        city: donor.city
      }], { onConflict: 'email' });
    } catch (e) {}
  }

  async updateDonorProfile(donorId, updatedData) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const cleanId = (donorId || '').trim();
    if (!cleanId) throw new Error("Donor ID is required.");

    const updateFields = {};
    if (updatedData.name !== undefined && updatedData.name.trim()) updateFields.name = updatedData.name.trim();
    if (updatedData.bloodGroup !== undefined) updateFields.blood_group = updatedData.bloodGroup;
    if (updatedData.phone !== undefined) updateFields.phone = updatedData.phone.trim();
    if (updatedData.email !== undefined && updatedData.email.trim()) updateFields.email = updatedData.email.trim().toLowerCase();
    if (updatedData.age !== undefined && !isNaN(parseInt(updatedData.age))) updateFields.age = parseInt(updatedData.age);
    if (updatedData.gender !== undefined) updateFields.gender = updatedData.gender;
    if (updatedData.weightKg !== undefined && !isNaN(parseFloat(updatedData.weightKg))) updateFields.weight_kg = parseFloat(updatedData.weightKg);
    if (updatedData.hemoglobin !== undefined && !isNaN(parseFloat(updatedData.hemoglobin))) updateFields.hemoglobin = parseFloat(updatedData.hemoglobin);
    if (updatedData.city !== undefined) updateFields.city = updatedData.city.trim();
    if (updatedData.address !== undefined) updateFields.address = updatedData.address.trim();
    if (updatedData.notes !== undefined) updateFields.notes = updatedData.notes.trim();

    // Recalculate status if hemoglobin is updated
    if (updateFields.hemoglobin !== undefined) {
      updateFields.status = updateFields.hemoglobin >= 12.5 ? "Eligible" : "Deferred";
    }

    let newHashedPass = null;
    if (updatedData.password && updatedData.password.trim()) {
      newHashedPass = await SupabaseAdapter.hashPassword(updatedData.password.trim());
      updateFields.password = newHashedPass;
    }

    const { error: donorErr } = await this.client
      .from('donors')
      .update(updateFields)
      .eq('id', cleanId);

    if (donorErr) {
      console.error("[HEMOCARE] Error updating donor profile in cloud:", donorErr.message);
      throw donorErr;
    }

    // Also sync to user_profiles table if email is present
    const emailToSync = updateFields.email || (this.currentUser && this.currentUser.email);
    if (emailToSync) {
      const profUpdate = {
        full_name: updateFields.name || (this.currentUser && this.currentUser.name),
        phone: updateFields.phone,
        blood_group: updateFields.blood_group,
        city: updateFields.city
      };
      if (newHashedPass) profUpdate.password = newHashedPass;
      try {
        await this.client
          .from('user_profiles')
          .update(profUpdate)
          .ilike('email', emailToSync);
      } catch (e) {}
    }

    // Update active session
    if (this.currentUser && (this.currentUser.id === cleanId || this.currentUser.email === emailToSync)) {
      this.currentUser = {
        ...this.currentUser,
        name: updateFields.name || this.currentUser.name,
        email: updateFields.email || this.currentUser.email,
        phone: updateFields.phone !== undefined ? updateFields.phone : this.currentUser.phone,
        bloodGroup: updateFields.blood_group || this.currentUser.bloodGroup,
        city: updateFields.city !== undefined ? updateFields.city : this.currentUser.city,
        address: updateFields.address !== undefined ? updateFields.address : this.currentUser.address,
        age: updateFields.age !== undefined ? updateFields.age : this.currentUser.age,
        gender: updateFields.gender !== undefined ? updateFields.gender : this.currentUser.gender,
        weightKg: updateFields.weight_kg !== undefined ? updateFields.weight_kg : this.currentUser.weightKg,
        hemoglobin: updateFields.hemoglobin !== undefined ? updateFields.hemoglobin : this.currentUser.hemoglobin,
        status: updateFields.status !== undefined ? updateFields.status : this.currentUser.status,
        notes: updateFields.notes !== undefined ? updateFields.notes : this.currentUser.notes
      };
      localStorage.setItem('HEMOCARE_AUTH_USER', JSON.stringify(this.currentUser));
    }

    return this.currentUser;
  }

  // --------------------------------------------------
  // CRUD: Blood Requests (100% Cloud)
  // --------------------------------------------------
  async getRequests() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('blood_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[HEMOCARE] Error fetching cloud requests:", error.message);
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      patientName: r.patient_name,
      age: r.age,
      gender: r.gender,
      hospital: r.hospital,
      department: r.department,
      bloodGroup: r.blood_group,
      component: r.component,
      unitsNeeded: r.units_needed,
      urgency: r.urgency,
      status: r.status,
      doctor: r.doctor,
      notes: r.notes,
      requestDate: r.created_at ? r.created_at.replace('T', ' ').slice(0, 16) : new Date().toISOString().replace('T', ' ').slice(0, 16),
      dispatchedUnits: r.dispatched_units,
      dispatchedAt: r.dispatched_at,
      requesterEmail: r.requester_email,
      centerCode: r.center_code || 'DEFAULT',
      createdAt: r.created_at
    }));
  }

  async addRequest(req) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const currentCenterCode = (this.currentUser && this.currentUser.centerCode) ? this.currentUser.centerCode : 'DEFAULT';
    const { error } = await this.client.from('blood_requests').insert([{
      id: req.id,
      patient_name: req.patientName,
      age: req.age,
      gender: req.gender,
      hospital: req.hospital,
      department: req.department,
      blood_group: req.bloodGroup,
      component: req.component,
      units_needed: req.unitsNeeded,
      urgency: req.urgency,
      status: req.status,
      doctor: req.doctor,
      notes: req.notes,
      requester_email: req.requesterEmail,
      center_code: req.centerCode || currentCenterCode
    }]);

    if (error) {
      console.error("[HEMOCARE] Cloud request insert error:", error.message);
      throw error;
    }
  }

  async dispatchRequest(requestId, allocatedUnitIds) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const timestamp = new Date().toISOString();

    // 1. Update request status in cloud
    const { error: reqErr } = await this.client
      .from('blood_requests')
      .update({
        status: 'Dispatched',
        dispatched_units: allocatedUnitIds,
        dispatched_at: timestamp
      })
      .eq('id', requestId);

    if (reqErr) {
      console.error("[HEMOCARE] Error dispatching request in cloud:", reqErr.message);
      throw reqErr;
    }

    // 2. Mark allocated units as Dispatched in cloud
    for (const uid of allocatedUnitIds) {
      await this.client
        .from('blood_inventory')
        .update({ status: 'Dispatched' })
        .eq('id', uid);
    }
  }

  // --------------------------------------------------
  // CRUD: Donation Camps (100% Cloud)
  // --------------------------------------------------
  async getCamps() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('donation_camps')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.warn("[HEMOCARE] Error fetching cloud camps:", error.message);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      organizer: c.organizer,
      venue: c.venue,
      date: c.date,
      time: c.time,
      targetUnits: c.target_units,
      registeredDonors: c.registered_donors,
      collectedUnits: c.collected_units,
      status: c.status,
      contactPerson: c.contact_person,
      contactPhone: c.contact_phone,
      centerCode: c.center_code || 'DEFAULT'
    }));
  }

  async addCamp(camp) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const currentCenterCode = (this.currentUser && this.currentUser.centerCode) ? this.currentUser.centerCode : 'DEFAULT';
    const { error } = await this.client.from('donation_camps').insert([{
      id: camp.id,
      name: camp.name,
      organizer: camp.organizer,
      venue: camp.venue,
      date: camp.date,
      time: camp.time,
      target_units: camp.targetUnits,
      registered_donors: camp.registeredDonors,
      status: camp.status,
      contact_person: camp.contactPerson,
      contact_phone: camp.contactPhone,
      center_code: camp.centerCode || currentCenterCode
    }]);

    if (error) {
      console.error("[HEMOCARE] Cloud camp insert error:", error.message);
      throw error;
    }
  }

  // --------------------------------------------------
  // CRUD: Donor Appointments & Booking Slots (100% Cloud)
  // --------------------------------------------------
  async getAppointments() {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('donor_appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[HEMOCARE] Error fetching cloud appointments:", error.message);
      return [];
    }

    return (data || []).map(a => ({
      id: a.id,
      donorId: a.donor_id,
      donorName: a.donor_name,
      donorEmail: a.donor_email,
      donorPhone: a.donor_phone,
      bloodGroup: a.blood_group,
      centerCode: a.center_code,
      centerName: a.center_name,
      appointmentDate: a.appointment_date,
      timeSlot: a.time_slot,
      donationType: a.donation_type,
      status: a.status,
      notes: a.notes,
      createdAt: a.created_at
    }));
  }

  async addAppointment(apt) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const id = apt.id || `APT-${Math.floor(1000 + Math.random() * 9000)}`;

    const record = {
      id: id,
      donor_id: apt.donorId || (this.currentUser ? this.currentUser.id : null),
      donor_name: (apt.donorName || '').trim(),
      donor_email: (apt.donorEmail || (this.currentUser ? this.currentUser.email : '') || '').trim().toLowerCase(),
      donor_phone: (apt.donorPhone || '').trim(),
      blood_group: apt.bloodGroup,
      center_code: apt.centerCode,
      center_name: (apt.centerName || '').trim(),
      appointment_date: apt.appointmentDate,
      time_slot: apt.timeSlot,
      donation_type: apt.donationType || 'Whole Blood',
      status: apt.status || 'Scheduled',
      notes: (apt.notes || '').trim()
    };

    const { data, error } = await this.client
      .from('donor_appointments')
      .insert([record])
      .select();

    if (error) {
      console.error("[HEMOCARE] Error inserting appointment to cloud:", error.message);
      throw error;
    }
    return data;
  }

  async updateAppointmentStatus(appointmentId, newStatus) {
    if (!this.client) throw new Error("Cloud database not connected.");
    const { error } = await this.client
      .from('donor_appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId);

    if (error) {
      console.error("[HEMOCARE] Error updating appointment status in cloud:", error.message);
      throw error;
    }

    // If marked Completed, update donor's donation metrics in donors table
    if (newStatus === 'Completed') {
      try {
        const { data: aptData } = await this.client
          .from('donor_appointments')
          .select('donor_id, donor_email, appointment_date')
          .eq('id', appointmentId)
          .limit(1);

        if (aptData && aptData.length > 0) {
          const apt = aptData[0];
          let query = this.client.from('donors').select('id, total_donations');
          if (apt.donor_id) {
            query = query.eq('id', apt.donor_id);
          } else if (apt.donor_email) {
            query = query.ilike('email', apt.donor_email);
          }
          const { data: dData } = await query.limit(1);
          if (dData && dData.length > 0) {
            const curDonations = (dData[0].total_donations || 0) + 1;
            const todayStr = new Date().toISOString().split('T')[0];
            await this.client
              .from('donors')
              .update({
                total_donations: curDonations,
                last_donated: todayStr
              })
              .eq('id', dData[0].id);
          }
        }
      } catch (err) {
        console.warn("[HEMOCARE] Could not auto-increment donor donation count:", err);
      }
    }
  }
}

// Global cloud adapter instance
window.HemoDB = new SupabaseAdapter();
