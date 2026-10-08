# HEMOCARE OS • Clinical Blood Bank Management System

> **A Cloud-Native, Clinical Blood Bank Management & Life Reserve System** featuring a dedicated Dual-Portal Architecture for **Citizens/Donors** and **Blood Bank Centers/Hospitals**. Built with pure **HTML5, Tailwind CSS, Vanilla JavaScript, and Multi-Threaded Python**, backed by **Supabase PostgreSQL** cloud database engine.

---

## 📑 Table of Contents

1. [🌟 System Architecture Overview](#-system-architecture-overview)
2. [👤 Part 1: Citizen & Voluntary Donor User Manual](#-part-1-citizen--voluntary-donor-user-manual)
   - [1.1 Public Emergency Blood Locator & Live Radar](#11-public-emergency-blood-locator--live-radar)
   - [1.2 Voluntary Donor Registration & Sign In](#12-voluntary-donor-registration--sign-in)
   - [1.3 Digital Holographic Donor ID Card](#13-digital-holographic-donor-id-card)
   - [1.4 Booking Center Donation Appointments](#14-booking-center-donation-appointments)
   - [1.5 Submitting Emergency Hospital Blood Requisitions](#15-submitting-emergency-hospital-blood-requisitions)
   - [1.6 Tracking Personal Requisitions](#16-tracking-personal-requisitions)
   - [1.7 Community Blood Drives & Donation Camps](#17-community-blood-drives--donation-camps)
   - [1.8 Updating Donor Medical Profile](#18-updating-donor-medical-profile)
3. [🏥 Part 2: Blood Bank Center & Hospital Operational Manual](#-part-2-blood-bank-center--hospital-operational-manual)
   - [2.1 Center Onboarding & License Registration](#21-center-onboarding--license-registration)
   - [2.2 Center Staff Authentication](#22-center-staff-authentication)
   - [2.3 Administrative Command Dashboard & Live KPIs](#23-administrative-command-dashboard--live-kpis)
   - [2.4 Real-Time Blood Matrix Grid](#24-real-time-blood-matrix-grid)
   - [2.5 Analytics: Ratio & Monthly Inflow vs Requests Trend](#25-analytics-ratio--monthly-inflow-vs-requests-trend)
   - [2.6 Cold Storage & Batch Inventory Management](#26-cold-storage--batch-inventory-management)
   - [2.7 Clinical Donor Registry & One-Click Donation Logging](#27-clinical-donor-registry--one-click-donation-logging)
   - [2.8 Hospital Requisition Processing & Dispatch Engine](#28-hospital-requisition-processing--dispatch-engine)
   - [2.9 Printable Transfusion Release Certificate](#29-printable-transfusion-release-certificate)
   - [2.10 Community Donation Drives & Mobile Camps Scheduler](#210-community-donation-drives--mobile-camps-scheduler)
   - [2.11 Managing Donor Appointments](#211-managing-donor-appointments)
   - [2.12 Center Facility Profile & Settings](#212-center-facility-profile--settings)
4. [💻 Part 3: Developer Setup, Installation & Supabase Integration](#-part-3-developer-setup-installation--supabase-integration)
   - [3.1 Technology Stack & Prerequisites](#31-technology-stack--prerequisites)
   - [3.2 Step 1: Clone the Repository](#32-step-1-clone-the-repository)
   - [3.3 Step 2: Supabase Database Setup & Secrets Configuration](#33-step-2-supabase-database-setup--secrets-configuration)
   - [3.4 Step 3: Run Database Schema SQL](#34-step-3-run-database-schema-sql)
   - [3.5 Step 4: Launching the Application](#35-step-4-launching-the-application)
   - [3.6 Repository Directory Structure](#36-repository-directory-structure)
   - [3.7 Backend API Endpoints](#37-backend-api-endpoints)

---

## 🌟 System Architecture Overview

HEMOCARE OS provides a streamlined, zero-overhead clinical blood reserve platform:
- **No Node.js runtime / npm build overhead**: Direct native execution using standards-compliant HTML5, Tailwind CSS via CDN, and vanilla ES6 modules.
- **Pure Cloud PostgreSQL Engine**: Direct connectivity to Supabase PostgreSQL with configured Row Level Security (RLS) policies.
- **Zero Mock / Dummy Fallbacks**: Analytics, matrices, inventory bays, requisitions, and donor lists query directly against cloud database tables.
- **High-Performance Multi-Threaded Server**: Python `run.py` server featuring `ThreadingServer` with automated socket abort interception and instant live synchronization pings.

---

## 👤 Part 1: Citizen & Voluntary Donor User Manual

### 1.1 Public Emergency Blood Locator & Live Radar
1. Navigate to the application home page (`http://localhost:8080`).
2. **Live Blood Stock Radar**: The top radar displays the current aggregate blood units in storage across all 8 ABO/Rh blood groups (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
3. **Public Emergency Locator**:
   - Select the required **Blood Group** dropdown.
   - Enter your **City** (e.g., `Hyderabad`, `Tirupati`, `Mumbai`).
   - Click **"Find Available Blood"**.
   - The radar filters instantly to show matching units, verified storage bays, and center contact information.

### 1.2 Voluntary Donor Registration & Sign In
1. In the top navigation bar, click **"User Portal"**.
2. **First-Time Donors (Registration)**:
   - Click **"Register as Voluntary Donor"**.
   - Provide your details:
     - **Full Name**
     - **Email Address** (used as unique login ID)
     - **Password** (min. 6 characters, securely hashed with SHA-256)
     - **Phone Number** (10-digit mobile)
     - **Blood Group** (e.g., `A+`, `O+`, `B+`, etc.)
     - **Age** (Must be between 18 and 65 years)
     - **Weight in kg** (Must be $\ge 50$ kg for medical safety)
     - **City** and Residential Address
   - Click **"Register & Create Digital Donor Card"**.
3. **Existing Donors (Sign In)**:
   - Enter your registered **Email** and **Password**.
   - Click **"Sign In to Donor Portal"**.

### 1.3 Digital Holographic Donor ID Card
Upon signing in to the User Portal, your verified medical donor card is displayed:
- **Holographic Medical Donor Card**:
  - Displays your official **Donor ID** (e.g., `DNR-8588`), **Full Name**, **Blood Group with Rh Factor**, and **City**.
  - **Lifetime Donations Counter**: Automatically increments each time a certified blood center logs your donation.
  - **Eligibility Countdown**: Clinical 90-day cooldown indicator calculating your next safe donation date based on your last logged donation.
  - **Print / Save Card**: Click **"Print Donor Card"** to generate a laboratory-compliant physical ID or PDF.

### 1.4 Booking Center Donation Appointments
1. On the Donor Portal dashboard, locate the **"Book Voluntary Donation Appointment"** section.
2. Select a verified **Blood Bank Center** from the certified centers dropdown.
3. Select an **Appointment Date** and preferred **Time Slot** (e.g., `10:00 AM - 11:00 AM`).
4. Select the **Donation Type**:
   - `Whole Blood` (Standard voluntary collection)
   - `Platelets (Apheresis)` (Single donor apheresis)
   - `Plasma` (Fresh frozen plasma apheresis)
   - `Red Blood Cells` (Packed red cells)
5. Add any optional clinical notes (e.g., "First-time donor", "Available on weekend morning").
6. Click **"Confirm Appointment Slot"**. Your booking is recorded in the `donor_appointments` table and will appear on both your dashboard and the center's schedule.

### 1.5 Submitting Emergency Hospital Blood Requisitions
If a family member or patient requires urgent transfusion:
1. Click **"Request Emergency Blood"** from the portal menu or dashboard widget.
2. Fill out the requisition form:
   - **Patient Full Name**
   - **Patient Age & Gender**
   - **Hospital Name** (e.g., `Apollo Hospitals Jubilee Hills`)
   - **Hospital Department** (e.g., `Emergency Trauma`, `Cardiothoracic Surgery`)
   - **Blood Group Required** & **Component** (`Whole Blood`, `Red Blood Cells`, `Platelets`, `Plasma`)
   - **Units Needed** (e.g., `2` units)
   - **Urgency Level**:
     - `CRITICAL` (Immediate emergency transfusion required $\le 1$ hour)
     - `URGENT` (Needed for scheduled procedure within 6 hours)
     - `NORMAL` (Standard requisition $\le 24$ hours)
   - **Attending Physician / Doctor Name**
   - Clinical diagnosis notes (e.g., "Post-accident acute blood loss").
3. Click **"Submit Blood Requisition"**.

### 1.6 Tracking Personal Requisitions
- Navigate to the **"My Requisitions & Hospital Orders"** tab in your Donor Portal.
- Review your active requests and their live statuses:
  - `Pending`: Order queued, awaiting blood bank component cross-match.
  - `Approved`: Units reserved in cold storage for the patient.
  - `Dispatched`: Blood units cold-packed and dispatched with hospital courier.
- When dispatched, click **"View Dispatch Slip"** to inspect the allocated unit IDs and authorized release timestamp.

### 1.7 Community Blood Drives & Donation Camps
- Switch to the **"Donation Drives & Mobile Camps"** tab.
- View upcoming drives with organizer details, venues, target units, and timings.
- Click **"Register to Donate at this Camp"** to pre-register your arrival.

### 1.8 Updating Donor Medical Profile
- Click **"Edit Profile"** in your Donor Portal.
- Update your contact phone number, residential address, weight, or hemoglobin readings.
- Click **"Save Changes"** to synchronize updates directly to PostgreSQL.

---

## 🏥 Part 2: Blood Bank Center & Hospital Operational Manual

### 2.1 Center Onboarding & License Registration
1. In the top navigation bar, click **"Center Staff Login"**.
2. Click **"Register New Blood Bank Center"**.
3. Complete the official center registration form:
   - **Unique Center Code** (e.g., `ABHA`, `CTR-APOLLO-01` — must be alphanumeric, no spaces).
   - **Blood Bank Name** (e.g., `Atma Blood Center`).
   - **Official Center Email**
   - **Master Staff Password**
   - **Official Contact Phone Number**
   - **Drug License / Registration Number** (e.g., `DL-TEL-2026-9812`)
   - **Center Category** (`Blood Bank & Component Center`, `Hospital Transfusion Service`, `Regional Blood Center`).
   - **City, State & Complete Facility Address**
   - **Authorized Medical Officer / Contact Person** (e.g., `Dr. Ramesh`).
4. Click **"Register Center & Provision Database"**.
   - The center is securely inserted into `public.blood_centers`.
   - Dedicated center context is immediately established.

### 2.2 Center Staff Authentication
1. Click **"Center Staff Login"**.
2. Enter your **Center Code or Official Email** and your **Password**.
3. Click **"Sign In to Administrative Console"**.
4. The system validates credentials against `public.blood_centers` using SHA-256 verification and loads your dedicated administrative dashboard.

### 2.3 Administrative Command Dashboard & Live KPIs
The Center Command Dashboard presents 5 real-time clinical indicators calculated from the database:
- **Total Units in Storage**: Total count of active, unexpired units with status `Available`.
- **Critical Shortages**: Number of blood groups with critical supply levels ($\le 1$ unit).
- **Active Eligible Donors**: Number of screened voluntary donors in your registry eligible to donate.
- **Pending Requisitions**: Number of urgent hospital blood requisitions waiting for allocation.
- **Booked Appointments**: Badge counter showing scheduled donor visits for today and the upcoming week.

### 2.4 Real-Time Blood Matrix Grid
- Displays individual inventory meters for all 8 blood groups (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
- Visual status badges:
  - `Optimal`: $\ge 3$ units in cold storage.
  - `Low Stock`: $2$ units remaining.
  - `Critical`: $1$ unit remaining (alert border).
  - `Depleted`: $0$ units remaining (pulsing crimson alert).
- **One-Click Requisition**: Click any blood group card to instantly initiate a pre-filled emergency request for that type.

### 2.5 Analytics: Ratio & Monthly Inflow vs Requests Trend
- **Blood Group Ratio (Doughnut Chart)**:
  - Visual breakdown of component availability across blood groups.
  - Powered by live database counts from `blood_inventory`.
- **Monthly Inflow vs Requests (Bar Chart)**:
  - **Donations Inflow (Crimson Bars)**: Exact count of blood units collected and entered into cold storage per month from `blood_inventory`.
  - **Hospital Dispatched (Blue Bars)**: Total blood units dispatched to hospitals per month from `blood_requests` (`status = 'Dispatched'`).
  - Rolling 5-month timeline dynamically computed from database records (`Jun`, `Jul`, `Aug`, `Sep`, `Oct`).
  - Hover over any bar to view exact clinical unit tallies.

### 2.6 Cold Storage & Batch Inventory Management
Navigate to the **"Inventory"** tab:
1. **Adding New Collected Units**:
   - Click **"+ Add Unit to Storage"**.
   - Select **Blood Group** and **Component** (`Whole Blood`, `Red Blood Cells`, `Platelets`, `Fresh Frozen Plasma`).
   - Enter **Volume** (typically $450\text{ ml}$ for Whole Blood, $250\text{ ml}$ for RBC/Platelets).
   - Enter **Donor Name** or donor record ID.
   - Enter **Collection Date** (defaults to current date).
   - The system automatically calculates expiration based on component biological shelf-life:
     - Whole Blood / Packed RBC: $+42$ days
     - Platelets: $+5$ days
     - Fresh Frozen Plasma: $+365$ days
   - Specify **Storage Location** (e.g., `Refrigerated Bay 1`, `Bay 2`, `Agitator Incubator A`, `Deep Freezer DF-1`).
   - Set **Initial Status** (`Available`, `Quarantined`, `Reserved`).
   - Click **"Place in Storage"**.
2. **Filtering & Searching**:
   - Filter by Blood Group, Component, or Status.
   - Real-time search by Unit ID (e.g., `BLD-2026-1001`), Donor Name, or Storage Bay.
3. **Biological Shelf-Life Actions**:
   - Units near expiration display warning badges.
   - Click **"Mark Expired"** to remove a compromised unit from active transfusion stock.
4. **Laboratory CSV Export**:
   - Click **"Export CSV"** to generate a downloadable audit manifest containing all unit IDs, blood groups, collection dates, and expiry dates.

### 2.7 Clinical Donor Registry & One-Click Donation Logging
Navigate to the **"Donors"** tab:
1. **Review Registered Voluntary Donors**:
   - Search by name, phone, city, or blood group.
   - View clinical parameters: Age, Gender, Body Weight ($\ge 50\text{ kg}$), Hemoglobin ($\ge 12.5\text{ g/dL}$), and Total Lifetime Donations.
2. **One-Click Donation Logging ("Log Donation")**:
   - When a donor arrives at the center and completes phlebotomy:
   - Click the **"Log Donation"** button on their donor card.
   - The system automatically:
     1. Creates a new certified unit in `blood_inventory` under their blood group with today's collection date.
     2. Increments the donor's `total_donations` counter.
     3. Updates their `last_donated` date to today.
     4. Sets their eligibility status to `Cooldown` (initiating 90-day cooldown).
     5. Refreshes the dashboard and monthly trend chart dynamically.

### 2.8 Hospital Requisition Processing & Dispatch Engine
Navigate to the **"Requisitions"** tab:
1. Review incoming emergency hospital requisitions organized by urgency (`CRITICAL`, `URGENT`, `NORMAL`).
2. **Dispatching Units**:
   - Click **"Process"** or **"Dispatch"** next to any pending order.
   - The allocation modal checks the database for compatible unreserved units.
   - Confirms blood group ABO/Rh compatibility.
   - Allocates the required units and updates requisition status to `Dispatched`.
   - Automatically marks the allocated units in `blood_inventory` as `Dispatched`.
   - Records the dispatch timestamp (`dispatched_at`) and allocated unit IDs.
   - Increments the center's monthly dispatch analytics.

### 2.9 Printable Transfusion Release Certificate
- On any dispatched requisition, click **"View Dispatch Slip"**.
- A formal **Clinical Blood Transfusion & Release Certificate** is generated displaying:
  - Official Certificate Release Code
  - Patient & Requesting Hospital Details
  - Assigned Attending Physician
  - Cross-matched Unit ID serial numbers
  - Authorized Cold-Chain Release Timestamp
  - Signature and Verification seals
- Click **"Print Certificate"** for paper physical handover to hospital couriers.

### 2.10 Community Donation Drives & Mobile Camps Scheduler
Navigate to the **"Camps"** tab:
1. Click **"+ Schedule New Camp"**.
2. Enter the **Drive Name** (e.g., `HITEC City Tech Park Blood Drive`), **Organizer**, **Venue**, **Date**, **Timings**, and **Target Units** (e.g., `100`).
3. Monitor registered voluntary donors and actual collected units during the drive.
4. Mark the drive status as `Upcoming`, `Ongoing`, or `Completed`.

### 2.11 Managing Donor Appointments
Navigate to the **"Appointments"** tab:
- Review donors who have scheduled appointments at your center.
- Inspect donor name, phone, blood group, scheduled date, time slot, and donation type.
- Update appointment status:
  - **Confirm**: Verify donor slot.
  - **Complete**: Mark donor arrival and collection completed.
  - **Cancel**: Cancel slot if donor cannot attend.

### 2.12 Center Facility Profile & Settings
- Click **"Facility Profile"** in the center navigation.
- View and update center contact phone, official email, drug license number, and facility address.
- Changes synchronize directly to `public.blood_centers`.

---

## 💻 Part 3: Developer Setup, Installation & Supabase Integration

### 3.1 Technology Stack & Prerequisites

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS (CDN), Vanilla JavaScript (ES6+), Chart.js, Lucide Icons |
| **Backend / Server** | Python 3.8+ (`ThreadingServer`, `SimpleHTTPRequestHandler`) |
| **Database** | PostgreSQL hosted on **Supabase** |
| **Database Driver** | `@supabase/supabase-js` (Browser Client) + `psycopg2` / REST (Admin & Scripts) |

**Prerequisites**:
- **Python 3.8 or higher** installed on your machine (`python --version`).
- **Git** installed on your machine (`git --version`).
- A free **Supabase Account** ([https://supabase.com](https://supabase.com)).

---

### 3.2 Step 1: Clone the Repository

Clone the project repository to your local machine:

```bash
git clone https://github.com/JAGANNATH2004/Shop.git blood-bank
cd blood-bank
```

---

### 3.3 Step 2: Supabase Database Setup & Secrets Configuration

> [!IMPORTANT]
> **CRITICAL DATABASE SETUP REQUIREMENT**:
> This application relies entirely on **Supabase PostgreSQL** as its single source of truth. Developers **must provide their own Supabase project credentials in the `.env` file**. Without valid Supabase credentials, the application will not synchronize data.

#### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com/) and click **"New Project"**.
2. Choose your organization, assign a project name (e.g., `hemocare-blood-bank`), and set a secure database password.
3. Select your preferred AWS region (e.g., `ap-south-1` for India / Asia).
4. Wait approximately 1–2 minutes for the database provisioning to complete.

#### 2. Obtain Your Supabase Credentials
Navigate to your Supabase project dashboard:
1. Go to **Project Settings > API**:
   - Copy the **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy the **Project API Keys > `anon` `public` key** (safe for browser clients).
   - Copy the **Project API Keys > `service_role` key** (secret key for administrative tasks).
2. Go to **Project Settings > Database**:
   - Scroll to **Connection string > URI**.
   - Copy the connection URI: `postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres`
   - Replace `[YOUR-PASSWORD]` with your actual database password.

#### 3. Create and Populate the `.env` File
In the project root directory, copy `.env.example` to `.env`:

```bash
# On Windows PowerShell
cp .env.example .env

# On Linux / macOS
cp .env.example .env
```

Open `.env` in your editor and fill in your actual Supabase credentials:

```ini
# ==============================================================================
# SUPABASE & POSTGRESQL PRODUCTION CREDENTIALS
# ==============================================================================

# Your Supabase Project URL
SUPABASE_URL="https://your-project-id.supabase.co"

# Supabase Public Anon Key (safe for frontend browser clients)
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Supabase Service Role Key (Keep secret, used for administrative operations)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# PostgreSQL Direct Connection URI
DATABASE_URL="postgresql://postgres.your-project-id:YourPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# Application Environment Configuration
APP_ENV="production"
APP_PORT=8080
```

---

### 3.4 Step 3: Run Database Schema SQL

To create the required database tables, views, RLS policies, and indexes in your Supabase database:

1. Open your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **SQL Editor** in the left sidebar.
3. Click **"New Query"**.
4. Open the file [`HemoCare_India_Locations.sql`](file:///c:/Users/admin/Desktop/Projects/blood/HemoCare_India_Locations.sql) in this repository, copy its **entire contents**, and paste them into the SQL editor.
5. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`).

#### Schema Structure Provisioned:
The SQL script establishes the following database entities:

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| `blood_centers` | Certified blood banks and hospital centers | `id`, `center_code`, `center_name`, `email`, `password`, `phone`, `city`, `address`, `license_number` |
| `user_profiles` | User profiles and portal accounts | `id`, `email`, `password`, `full_name`, `role`, `phone`, `blood_group`, `city`, `center_code` |
| `blood_inventory`| Individual blood units in cold storage | `id`, `blood_group`, `component`, `volume_ml`, `donor_name`, `collected_date`, `expiry_date`, `storage_location`, `center_code`, `status` |
| `donors` | Clinical voluntary donor registry | `id`, `name`, `password`, `age`, `gender`, `blood_group`, `phone`, `email`, `city`, `weight_kg`, `hemoglobin`, `total_donations`, `last_donated`, `status` |
| `blood_requests` | Hospital requisitions & dispatch tracking | `id`, `patient_name`, `age`, `hospital`, `department`, `blood_group`, `component`, `units_needed`, `urgency`, `status`, `doctor`, `center_code`, `dispatched_units`, `dispatched_at` |
| `donation_camps` | Scheduled community donation drives | `id`, `name`, `organizer`, `venue`, `date`, `time`, `target_units`, `registered_donors`, `collected_units`, `status`, `center_code` |
| `donor_appointments` | Booked donor slots at certified centers | `id`, `donor_id`, `donor_name`, `blood_group`, `center_code`, `center_name`, `appointment_date`, `time_slot`, `donation_type`, `status` |

---

### 3.5 Step 4: Launching the Application

Start the local server using Python:

```powershell
python run.py
```

Upon launching, `run.py` performs the following operations:
1. Loads `.env` configuration.
2. Performs a live HTTP/PostgreSQL database verification probe against your Supabase endpoint.
3. Finds the configured port (`8080` by default, or next available port).
4. Launches the high-performance multi-threaded `ThreadingServer`.
5. Automatically opens your default web browser to **`http://localhost:8080`**.

Terminal output confirmation:
```
====================================================================
   🩸 HEMOCARE OS • Clinical Blood Bank Management System
====================================================================
  [+] Working Directory  : C:\Users\admin\Desktop\Projects\blood
  [+] Local Server URL   : http://localhost:8080
  [+] Supabase Config    : Loaded via .env
--------------------------------------------------------------------
  ⚡ DATABASE SYNCHRONIZATION CONFIRMATION:
     • Cloud Database    : https://your-project-id.supabase.co
     • Engine Adapter    : 100% Pure Cloud Database (Supabase PostgreSQL)
     • Local Storage     : Disabled (Completely Removed - Pure Cloud)
     • Monitored Tables  : blood_centers, donors, blood_inventory, blood_requests, donation_camps, donor_appointments, user_profiles
     • Cloud Sync Health : Connected to Supabase PostgreSQL (HTTP 200 OK)
     • Terminal Status   : [✔] 100% CLOUD DATABASE SYNCHRONIZATION CONFIRMED ACTIVE
====================================================================
  🚀 Quick Access Portals:
     • Landing & Locator   : http://localhost:8080
     • User / Donor Portal : Click 'User Portal' (Sign In or Register)
     • Center Admin Portal : Click 'Center Staff Login' (Sign In or Register New Center)
--------------------------------------------------------------------
  Press Ctrl+C to safely terminate the server.
====================================================================
```

---

### 3.6 Repository Directory Structure

```
c:\Users\admin\Desktop\Projects\blood\
├── .env                          # Supabase URL and production API keys (gitignored)
├── .env.example                  # Environment configuration template for developers
├── .gitignore                    # Prevents secret keys and temporary cache from being committed
├── HemoCare_India_Locations.sql  # Complete Supabase PostgreSQL schema, tables, and RLS policies
├── index.html                    # Single-page clinical interface (Landing, User Portal, Center Console)
├── README.md                     # Comprehensive User & Operational Manual and Developer Setup Guide
├── run.py                        # Multi-threaded server runner with database sync verification
├── css/
│   └── style.css                 # Bespoke clinical styling, glassmorphism, donor ID card, print styles
└── js/
    ├── data.js                   # ABO/Rh compatibility matrices and clinical guidelines
    ├── supabase-client.js        # Supabase JavaScript client adapter & live PostgreSQL CRUD engine
    └── app.js                    # Core UI controller, portal routing, session management, and live charts
```

---

### 3.7 Backend API Endpoints

The local Python runner exposes endpoints for diagnostics, health checks, and secure configuration passing:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the main web application (`index.html`). |
| `GET` | `/api/config` | Returns public client configuration (`url` and public `anonKey` only). No secret service keys are ever exposed. |
| `GET` | `/api/db-status` | Returns live synchronization status with Supabase PostgreSQL and confirmed tables list. |
| `POST` | `/api/sync-ping` | Endpoint for the frontend 30-second heartbeat to confirm dashboard synchronization. |
| `GET` | `/favicon.svg` | Serves dynamic SVG blood droplet favicon to eliminate 404 logs. |

---

## 🔒 Security Best Practices for Developers

1. **Keep Secrets Out of Version Control**:
   - Never commit `.env` containing your `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` password to GitHub.
   - The `.gitignore` file is pre-configured to ignore `.env`, `.pyc`, and system directories.
2. **Row Level Security (RLS)**:
   - All tables created via `HemoCare_India_Locations.sql` have RLS enabled.
   - For production enterprise multi-tenant deployments, customize the RLS policies in Supabase to restrict center staff access exclusively to records matching their authenticated `center_code`.
3. **Password Security**:
   - Both donor accounts and center accounts utilize SHA-256 cryptographic hashing prior to database storage.
