/**
 * HEMOCARE OS - Blood Compatibility Rules & Clinical Thresholds
 * 100% Cloud-Integrated Database Architecture
 * All dynamic data is stored strictly in Cloud Supabase PostgreSQL.
 */

// Blood compatibility matrices
const BLOOD_COMPATIBILITY = {
  'O-': {
    giveTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal donor
    receiveFrom: ['O-']
  },
  'O+': {
    giveTo: ['O+', 'A+', 'B+', 'AB+'],
    receiveFrom: ['O-', 'O+']
  },
  'A-': {
    giveTo: ['A-', 'A+', 'AB-', 'AB+'],
    receiveFrom: ['O-', 'A-']
  },
  'A+': {
    giveTo: ['A+', 'AB+'],
    receiveFrom: ['O-', 'O+', 'A-', 'A+']
  },
  'B-': {
    giveTo: ['B-', 'B+', 'AB-', 'AB+'],
    receiveFrom: ['O-', 'B-']
  },
  'B+': {
    giveTo: ['B+', 'AB+'],
    receiveFrom: ['O-', 'O+', 'B-', 'B+']
  },
  'AB-': {
    giveTo: ['AB-', 'AB+'],
    receiveFrom: ['O-', 'A-', 'B-', 'AB-']
  },
  'AB+': {
    giveTo: ['AB+'],
    receiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] // Universal recipient
  }
};

