// tests/mocks/data-mock.js - Enterprise Mock Data for Testing 2026
/**
 * E-Arsip Digital - Comprehensive Mock Data
 * Version: 2026.1.0
 * Provides realistic, interconnected mock data for all test suites
 * Features: Dynamic timestamps, entity relationships, complete status coverage
 */

const NOW = new Date();
const DAY = 86400000;

// Helper to create relative dates
const daysAgo = (days, hours = 0, minutes = 0) => {
    const date = new Date(NOW - days * DAY);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
};

const hoursAgo = (hours) => {
    return new Date(NOW - hours * 3600000).toISOString();
};

const dataMock = {
    // ============================================
    // USERS (with complete roles & realistic data)
    // ============================================
    users: [
        {
            id: 'user-001',
            username: 'admin',
            password: 'Password123!',
            fullname: 'Administrator',
            email: 'admin@e-arsip.id',
            phone: '081234567890',
            role: 'super_admin',
            unit: 'Dekanat',
            nip: '198501012010011001',
            status: 'active',
            avatar: null,
            permissions: ['manage_users', 'manage_surat', 'approve_surat', 'view_reports', 'export_data', 'manage_settings', 'view_logs', 'backup_restore'],
            lastLogin: hoursAgo(2),
            failedLogins: 0,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: hoursAgo(2)
        },
        {
            id: 'user-002',
            username: 'dekan',
            password: 'Password123!',
            fullname: 'Dr. Ahmad Fauzi, M.Kom',
            email: 'dekan@e-arsip.id',
            phone: '081234567891',
            role: 'dekan',
            unit: 'Dekanat',
            nip: '197506152005011002',
            status: 'active',
            avatar: null,
            permissions: ['approve_surat', 'view_reports', 'export_data'],
            lastLogin: hoursAgo(24),
            failedLogins: 0,
            createdAt: '2025-01-15T00:00:00Z',
            updatedAt: hoursAgo(24)
        },
        {
            id: 'user-003',
            username: 'wadek',
            password: 'Password123!',
            fullname: 'Dr. Rina Wati, M.Pd.',
            email: 'wadek@e-arsip.id',
            phone: '081234567892',
            role: 'wadek',
            unit: 'Dekanat',
            nip: '198012102008012002',
            status: 'active',
            avatar: null,
            permissions: ['approve_surat', 'view_reports'],
            lastLogin: hoursAgo(48),
            failedLogins: 1,
            createdAt: '2025-02-01T00:00:00Z',
            updatedAt: hoursAgo(48)
        },
        {
            id: 'user-004',
            username: 'kaprodi_ti',
            password: 'Password123!',
            fullname: 'Siti Nurhaliza, S.Kom., M.T.',
            email: 'kaprodi_ti@e-arsip.id',
            phone: '081234567893',
            role: 'kaprodi',
            unit: 'Prodi TI',
            nip: '198802122010012003',
            status: 'active',
            avatar: null,
            permissions: ['manage_surat', 'view_reports'],
            lastLogin: hoursAgo(72),
            failedLogins: 0,
            createdAt: '2025-02-15T00:00:00Z',
            updatedAt: hoursAgo(72)
        },
        {
            id: 'user-005',
            username: 'kaprodi_si',
            password: 'Password123!',
            fullname: 'Dedi Kusuma, Ph.D.',
            email: 'kaprodi_si@e-arsip.id',
            phone: '081234567894',
            role: 'kaprodi',
            unit: 'Prodi SI',
            nip: '198505152012011004',
            status: 'active',
            avatar: null,
            permissions: ['manage_surat', 'view_reports'],
            lastLogin: hoursAgo(96),
            failedLogins: 2,
            createdAt: '2025-03-01T00:00:00Z',
            updatedAt: hoursAgo(96)
        },
        {
            id: 'user-006',
            username: 'staf_tu',
            password: 'Password123!',
            fullname: 'Budi Santoso, A.Md.',
            email: 'staf@e-arsip.id',
            phone: '081234567895',
            role: 'staf',
            unit: 'BAAK',
            nip: '199203152015011004',
            status: 'active',
            avatar: null,
            permissions: ['manage_surat'],
            lastLogin: hoursAgo(6),
            failedLogins: 0,
            createdAt: '2025-04-01T00:00:00Z',
            updatedAt: hoursAgo(6)
        },
        {
            id: 'user-007',
            username: 'dosen_ti',
            password: 'Password123!',
            fullname: 'Rudi Hartono, M.Kom.',
            email: 'rudi@e-arsip.id',
            phone: '081234567896',
            role: 'dosen',
            unit: 'Prodi TI',
            nip: '199005102018011005',
            status: 'active',
            avatar: null,
            permissions: [],
            lastLogin: daysAgo(5),
            failedLogins: 0,
            createdAt: '2025-06-01T00:00:00Z',
            updatedAt: daysAgo(5)
        },
        {
            id: 'user-008',
            username: 'mahasiswa1',
            password: 'Password123!',
            fullname: 'Dewi Lestari',
            email: 'dewi@student.id',
            phone: '081234567897',
            role: 'mahasiswa',
            unit: 'Prodi TI',
            nip: null,
            status: 'active',
            avatar: null,
            permissions: [],
            lastLogin: daysAgo(10),
            failedLogins: 0,
            createdAt: '2025-08-01T00:00:00Z',
            updatedAt: daysAgo(10)
        },
        {
            id: 'user-009',
            username: 'inactive_user',
            password: 'Password123!',
            fullname: 'User Nonaktif',
            email: 'inactive@e-arsip.id',
            phone: '081234567898',
            role: 'staf',
            unit: 'BAUK',
            nip: '198807072010011006',
            status: 'inactive',
            avatar: null,
            permissions: [],
            lastLogin: daysAgo(30),
            failedLogins: 5,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: daysAgo(30)
        },
        {
            id: 'user-010',
            username: 'pending_user',
            password: 'Password123!',
            fullname: 'User Pending',
            email: 'pending@e-arsip.id',
            phone: '081234567899',
            role: 'dosen',
            unit: 'Prodi SI',
            nip: '199112122019011007',
            status: 'pending',
            avatar: null,
            permissions: [],
            lastLogin: null,
            failedLogins: 0,
            createdAt: daysAgo(1),
            updatedAt: daysAgo(1)
        }
    ],

    // ============================================
    // SURAT KELUAR (complete lifecycle)
    // ============================================
    suratKeluar: [
        {
            id: 'sk-001',
            nomor_surat: '001/UN.01/UM/I/2026',
            perihal: 'Undangan Rapat Koordinasi Semester Genap',
            jenis: 'undangan',
            sifat: 'segera',
            tujuan: 'Seluruh Kaprodi',
            tanggal_surat: '2026-01-10',
            status: 'completed',
            pengaju: 'Staf TU',
            pengaju_id: 'user-006',
            penandatangan: 'Dr. Ahmad Fauzi, M.Kom',
            penandatangan_id: 'user-002',
            isi_ringkas: 'Mengundang seluruh Kaprodi untuk rapat koordinasi persiapan semester genap 2025/2026',
            klasifikasi: 'UM',
            tembusan: ['Wadek I', 'Wadek II'],
            approval_history: [
                { step: 1, approver: 'Admin', approver_id: 'user-001', status: 'approved', catatan: 'Surat sudah sesuai format', timestamp: '2026-01-10T08:00:00Z' },
                { step: 2, approver: 'Dekan', approver_id: 'user-002', status: 'approved', catatan: 'Disetujui untuk diedarkan', timestamp: '2026-01-10T14:00:00Z' }
            ],
            tracking: [
                { status: 'draft', timestamp: '2026-01-10T07:00:00Z', user: 'Staf TU' },
                { status: 'submitted', timestamp: '2026-01-10T07:30:00Z', user: 'Staf TU' },
                { status: 'pending_admin', timestamp: '2026-01-10T07:30:00Z' },
                { status: 'pending_dekan', timestamp: '2026-01-10T08:00:00Z' },
                { status: 'completed', timestamp: '2026-01-10T14:00:00Z' }
            ],
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=001/UN.01/UM/I/2026',
            fileUrl: 'https://drive.google.com/file/sk-001',
            createdBy: 'user-006',
            createdAt: '2026-01-10T07:00:00Z',
            updatedAt: '2026-01-10T14:00:00Z'
        },
        {
            id: 'sk-002',
            nomor_surat: '002/UN.01/KU/I/2026',
            perihal: 'Permohonan Dana Kegiatan Workshop',
            jenis: 'permohonan',
            sifat: 'biasa',
            tujuan: 'BAUK',
            tanggal_surat: '2026-01-12',
            status: 'pending_wadek',
            pengaju: 'Kaprodi TI',
            pengaju_id: 'user-004',
            penandatangan: null,
            isi_ringkas: 'Mengajukan dana untuk kegiatan workshop pemrograman web modern',
            klasifikasi: 'KU',
            tembusan: [],
            approval_history: [
                { step: 1, approver: 'Admin', approver_id: 'user-001', status: 'approved', catatan: 'Lengkapi lampiran RAB', timestamp: '2026-01-12T09:00:00Z' }
            ],
            tracking: [
                { status: 'draft', timestamp: '2026-01-12T08:00:00Z', user: 'Kaprodi TI' },
                { status: 'submitted', timestamp: '2026-01-12T08:30:00Z', user: 'Kaprodi TI' },
                { status: 'pending_admin', timestamp: '2026-01-12T08:30:00Z' },
                { status: 'pending_wadek', timestamp: '2026-01-12T09:00:00Z' }
            ],
            qrCode: null,
            fileUrl: null,
            createdBy: 'user-004',
            createdAt: '2026-01-12T08:00:00Z',
            updatedAt: '2026-01-12T09:00:00Z'
        },
        {
            id: 'sk-003',
            nomor_surat: null,
            perihal: 'Pengumuman Jadwal Ujian Akhir Semester',
            jenis: 'pengumuman',
            sifat: 'penting',
            tujuan: 'Seluruh Mahasiswa',
            tanggal_surat: '2026-01-14',
            status: 'draft',
            pengaju: 'Staf TU',
            pengaju_id: 'user-006',
            penandatangan: null,
            isi_ringkas: 'Memberitahukan jadwal ujian akhir semester genap 2025/2026',
            klasifikasi: 'AK',
            tembusan: [],
            approval_history: [],
            tracking: [
                { status: 'draft', timestamp: '2026-01-14T10:00:00Z', user: 'Staf TU' }
            ],
            qrCode: null,
            fileUrl: null,
            createdBy: 'user-006',
            createdAt: '2026-01-14T10:00:00Z',
            updatedAt: '2026-01-14T10:00:00Z'
        },
        {
            id: 'sk-004',
            nomor_surat: '004/UN.01/KER/I/2026',
            perihal: 'Proposal Kerjasama Penelitian AI',
            jenis: 'proposal',
            sifat: 'rahasia',
            tujuan: 'PT. Teknologi Nusantara',
            tanggal_surat: '2026-01-15',
            status: 'completed',
            pengaju: 'Dekan',
            pengaju_id: 'user-002',
            penandatangan: 'Dr. Ahmad Fauzi, M.Kom',
            penandatangan_id: 'user-002',
            isi_ringkas: 'Mengajukan proposal kerjasama penelitian bidang Artificial Intelligence',
            klasifikasi: 'KER',
            tembusan: ['Warek III', 'Kepala LPPM'],
            approval_history: [
                { step: 1, approver: 'Admin', approver_id: 'user-001', status: 'approved', catatan: 'OK, lengkap', timestamp: '2026-01-15T08:00:00Z' },
                { step: 2, approver: 'Wadek', approver_id: 'user-003', status: 'approved', catatan: 'Setuju', timestamp: '2026-01-15T11:00:00Z' },
                { step: 3, approver: 'Dekan', approver_id: 'user-002', status: 'approved', catatan: 'Lanjutkan kerjasama', timestamp: '2026-01-15T13:00:00Z' }
            ],
            tracking: [
                { status: 'draft', timestamp: '2026-01-15T07:00:00Z', user: 'Admin' },
                { status: 'submitted', timestamp: '2026-01-15T07:30:00Z', user: 'Admin' },
                { status: 'pending_admin', timestamp: '2026-01-15T07:30:00Z' },
                { status: 'pending_wadek', timestamp: '2026-01-15T08:00:00Z' },
                { status: 'pending_dekan', timestamp: '2026-01-15T11:00:00Z' },
                { status: 'completed', timestamp: '2026-01-15T13:00:00Z' }
            ],
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=004/UN.01/KER/I/2026',
            fileUrl: 'https://drive.google.com/file/sk-004',
            createdBy: 'user-001',
            createdAt: '2026-01-15T07:00:00Z',
            updatedAt: '2026-01-15T13:00:00Z'
        },
        {
            id: 'sk-005',
            nomor_surat: '005/UN.01/SK/I/2026',
            perihal: 'Surat Keputusan Pengangkatan Koordinator',
            jenis: 'keputusan',
            sifat: 'penting',
            tujuan: 'Dr. Budi Prasetyo',
            tanggal_surat: '2026-01-08',
            status: 'ditolak',
            pengaju: 'Admin',
            pengaju_id: 'user-001',
            penandatangan: null,
            isi_ringkas: 'SK Pengangkatan sebagai Koordinator Penelitian dan Pengabdian',
            klasifikasi: 'SK',
            tembusan: [],
            approval_history: [
                { step: 1, approver: 'Dekan', approver_id: 'user-002', status: 'rejected', catatan: 'Revisi isi SK, sesuaikan dengan format terbaru', timestamp: '2026-01-09T10:00:00Z' }
            ],
            tracking: [
                { status: 'draft', timestamp: '2026-01-08T09:00:00Z', user: 'Admin' },
                { status: 'submitted', timestamp: '2026-01-08T10:00:00Z', user: 'Admin' },
                { status: 'pending_dekan', timestamp: '2026-01-08T10:00:00Z' },
                { status: 'ditolak', timestamp: '2026-01-09T10:00:00Z' }
            ],
            qrCode: null,
            fileUrl: null,
            catatanPenolakan: 'Revisi isi SK, sesuaikan dengan format terbaru',
            createdBy: 'user-001',
            createdAt: '2026-01-08T09:00:00Z',
            updatedAt: '2026-01-09T10:00:00Z'
        }
    ],

    // ============================================
    // SURAT MASUK (complete with tracking)
    // ============================================
    suratMasuk: [
        {
            id: 'sm-001',
            nomor_surat: 'B-123/DIKTI/I/2026',
            perihal: 'Pemberitahuan Hibah Penelitian Tahun 2026',
            pengirim: 'Direktur Jenderal Pendidikan Tinggi',
            instansi: 'Kemendikbud RI',
            tgl_surat: '2026-01-05',
            tgl_terima: '2026-01-08',
            jenis: 'pemberitahuan',
            sifat: 'penting',
            isi_ringkas: 'Memberitahukan penerimaan hibah penelitian untuk tahun anggaran 2026',
            status: 'diteruskan',
            diteruskanKepada: 'Wadek I',
            tracking: [
                { status: 'diterima', timestamp: '2026-01-08T10:00:00Z', user: 'Staf TU' },
                { status: 'diagendakan', timestamp: '2026-01-08T10:30:00Z', user: 'Staf TU' },
                { status: 'disposisi_dekan', timestamp: '2026-01-09T08:00:00Z', user: 'Dekan' },
                { status: 'diteruskan', timestamp: '2026-01-10T10:00:00Z', user: 'Wadek I' }
            ],
            createdBy: 'user-006',
            createdAt: '2026-01-08T10:00:00Z',
            updatedAt: '2026-01-10T10:00:00Z'
        },
        {
            id: 'sm-002',
            nomor_surat: '045/KOP/I/2026',
            perihal: 'Undangan Seminar Nasional Teknologi Informasi',
            pengirim: 'Ketua Panitia Seminar',
            instansi: 'Universitas Indonesia',
            tgl_surat: '2026-01-10',
            tgl_terima: '2026-01-12',
            jenis: 'undangan',
            sifat: 'biasa',
            isi_ringkas: 'Mengundang dosen untuk menjadi pembicara pada seminar nasional',
            status: 'diteruskan',
            diteruskanKepada: 'Kaprodi TI',
            tracking: [
                { status: 'diterima', timestamp: '2026-01-12T11:00:00Z', user: 'Staf TU' },
                { status: 'diagendakan', timestamp: '2026-01-12T11:30:00Z', user: 'Staf TU' },
                { status: 'disposisi_dekan', timestamp: '2026-01-13T09:00:00Z', user: 'Dekan' },
                { status: 'diteruskan', timestamp: '2026-01-13T09:30:00Z', user: 'Kaprodi TI' }
            ],
            createdBy: 'user-006',
            createdAt: '2026-01-12T11:00:00Z',
            updatedAt: '2026-01-13T09:30:00Z'
        },
        {
            id: 'sm-003',
            nomor_surat: '089/PT.TN/I/2026',
            perihal: 'Penawaran Program Magang Mahasiswa',
            pengirim: 'HRD Manager',
            instansi: 'PT. Teknologi Nusantara',
            tgl_surat: '2026-01-13',
            tgl_terima: '2026-01-15',
            jenis: 'penawaran',
            sifat: 'segera',
            isi_ringkas: 'Menawarkan program magang untuk mahasiswa semester akhir',
            status: 'diterima',
            tracking: [
                { status: 'diterima', timestamp: '2026-01-15T08:00:00Z', user: 'Staf TU' }
            ],
            createdBy: 'user-006',
            createdAt: '2026-01-15T08:00:00Z',
            updatedAt: '2026-01-15T08:00:00Z'
        }
    ],

    // ============================================
    // DISPOSISI (complete chain)
    // ============================================
    disposisi: [
        {
            id: 'disp-001',
            surat_id: 'sm-001',
            surat_nomor: 'B-123/DIKTI/I/2026',
            dari: 'Dekan',
            dari_id: 'user-002',
            kepada: 'Wadek I',
            kepada_id: 'user-003',
            isi_disposisi: 'Mohon ditindaklanjuti dan disiapkan proposal hibahnya. Koordinasikan dengan Kaprodi terkait.',
            sifat: 'segera',
            prioritas: 'tinggi',
            batas_waktu: '2026-01-20',
            status: 'proses',
            catatan_tindak_lanjut: null,
            createdAt: '2026-01-09T08:00:00Z',
            updatedAt: '2026-01-09T08:00:00Z'
        },
        {
            id: 'disp-002',
            surat_id: 'sm-002',
            surat_nomor: '045/KOP/I/2026',
            dari: 'Dekan',
            dari_id: 'user-002',
            kepada: 'Kaprodi TI',
            kepada_id: 'user-004',
            isi_disposisi: 'Silakan ditunjuk dosen yang kompeten untuk menjadi pembicara seminar.',
            sifat: 'biasa',
            prioritas: 'normal',
            batas_waktu: '2026-01-25',
            status: 'proses',
            catatan_tindak_lanjut: null,
            createdAt: '2026-01-13T09:00:00Z',
            updatedAt: '2026-01-13T09:00:00Z'
        },
        {
            id: 'disp-003',
            surat_id: 'sm-001',
            surat_nomor: 'B-123/DIKTI/I/2026',
            dari: 'Wadek I',
            dari_id: 'user-003',
            kepada: 'Kaprodi TI',
            kepada_id: 'user-004',
            isi_disposisi: 'Siapkan tim untuk menyusun proposal hibah. Deadline 18 Januari.',
            sifat: 'segera',
            prioritas: 'tinggi',
            batas_waktu: '2026-01-18',
            status: 'selesai',
            catatan_tindak_lanjut: 'Tim telah dibentuk dan proposal sedang disusun',
            createdAt: '2026-01-10T10:00:00Z',
            updatedAt: '2026-01-12T15:00:00Z'
        }
    ],

    // ============================================
    // NOTIFICATIONS (realistic distribution)
    // ============================================
    notifications: [
        {
            id: 'notif-001',
            type: 'success',
            category: 'approval',
            title: 'Surat Disetujui',
            message: 'Surat No. 001/UN.01/UM/I/2026 telah disetujui oleh Dekan.',
            read: false,
            link: '/surat-keluar/preview.html?id=sk-001',
            createdAt: '2026-01-10T14:00:00Z'
        },
        {
            id: 'notif-002',
            type: 'warning',
            category: 'disposisi',
            title: 'Batas Waktu Disposisi',
            message: 'Disposisi untuk surat B-123/DIKTI/I/2026 akan berakhir dalam 2 hari.',
            read: false,
            link: '/surat-masuk/disposisi.html?id=sm-001',
            createdAt: daysAgo(2, 8)
        },
        {
            id: 'notif-003',
            type: 'info',
            category: 'sistem',
            title: 'Backup Berhasil',
            message: 'Backup sistem otomatis telah berhasil dibuat.',
            read: true,
            link: '/pengaturan/backup.html',
            createdAt: daysAgo(5, 2)
        },
        {
            id: 'notif-004',
            type: 'info',
            category: 'surat',
            title: 'Surat Masuk Baru',
            message: 'Surat masuk dari PT. Teknologi Nusantara telah dicatat.',
            read: true,
            link: '/surat-masuk/list.html',
            createdAt: '2026-01-15T08:00:00Z'
        },
        {
            id: 'notif-005',
            type: 'error',
            category: 'approval',
            title: 'Approval Ditolak',
            message: 'Surat SK Pengangkatan ditolak dengan catatan: Revisi isi SK.',
            read: false,
            link: '/surat-keluar/approval.html',
            createdAt: '2026-01-09T10:00:00Z'
        },
        {
            id: 'notif-006',
            type: 'success',
            category: 'disposisi',
            title: 'Disposisi Selesai',
            message: 'Disposisi untuk surat B-123/DIKTI/I/2026 telah ditindaklanjuti.',
            read: true,
            link: '/surat-masuk/disposisi.html?id=sm-001',
            createdAt: '2026-01-12T15:00:00Z'
        },
        {
            id: 'notif-007',
            type: 'info',
            category: 'security',
            title: 'Login dari Perangkat Baru',
            message: 'Akun Anda diakses dari perangkat baru (Chrome on Windows).',
            read: false,
            link: '/profile/#security',
            createdAt: hoursAgo(3)
        }
    ],

    // ============================================
    // BACKUPS
    // ============================================
    backups: [
        {
            id: 'backup-001',
            name: 'backup-2026-01-15-full',
            type: 'full',
            size: 15728640,
            status: 'completed',
            createdAt: '2026-01-15T02:00:00Z'
        },
        {
            id: 'backup-002',
            name: 'backup-2026-01-08-full',
            type: 'full',
            size: 14680064,
            status: 'completed',
            createdAt: '2026-01-08T02:00:00Z'
        },
        {
            id: 'backup-003',
            name: 'backup-2026-01-01-surat',
            type: 'surat',
            size: 5242880,
            status: 'completed',
            createdAt: '2026-01-01T02:00:00Z'
        }
    ],

    // ============================================
    // SIGNATURES
    // ============================================
    signatures: [
        {
            id: 'ttd-001',
            name: 'Dr. Ahmad Fauzi, M.Kom',
            position: 'Dekan',
            image: null,
            isDefault: true,
            createdAt: '2026-01-01T00:00:00Z'
        },
        {
            id: 'ttd-002',
            name: 'Siti Nurhaliza, S.Kom., M.T.',
            position: 'Kaprodi Teknik Informatika',
            image: null,
            isDefault: false,
            createdAt: '2026-01-02T00:00:00Z'
        },
        {
            id: 'ttd-003',
            name: 'Dr. Rina Wati, M.Pd.',
            position: 'Wakil Dekan I',
            image: null,
            isDefault: false,
            createdAt: '2026-01-03T00:00:00Z'
        }
    ],

    // ============================================
    // ACTIVITY LOGS (comprehensive)
    // ============================================
    logs: [
        {
            id: 'log-001',
            type: 'login',
            description: 'Administrator berhasil login',
            user: { id: 'user-001', name: 'Administrator' },
            details: { ip: '192.168.1.1', browser: 'Chrome 120', os: 'Windows 11' },
            timestamp: hoursAgo(2)
        },
        {
            id: 'log-002',
            type: 'create',
            description: 'Membuat surat keluar: Proposal Kerjasama Penelitian AI',
            user: { id: 'user-001', name: 'Administrator' },
            details: { surat_id: 'sk-004', nomor_surat: '004/UN.01/KER/I/2026' },
            timestamp: '2026-01-15T07:00:00Z'
        },
        {
            id: 'log-003',
            type: 'approve',
            description: 'Menyetujui surat: Proposal Kerjasama Penelitian AI',
            user: { id: 'user-002', name: 'Dr. Ahmad Fauzi, M.Kom' },
            details: { surat_id: 'sk-004', status: 'disetujui' },
            timestamp: '2026-01-15T13:00:00Z'
        },
        {
            id: 'log-004',
            type: 'create',
            description: 'Input surat masuk: Penawaran Program Magang Mahasiswa',
            user: { id: 'user-006', name: 'Budi Santoso, A.Md.' },
            details: { surat_id: 'sm-003', instansi: 'PT. Teknologi Nusantara' },
            timestamp: '2026-01-15T08:00:00Z'
        },
        {
            id: 'log-005',
            type: 'security',
            description: 'Percobaan login gagal (3 kali)',
            user: { id: null, name: 'unknown' },
            details: { username: 'hacker', attempts: 3, ip: '10.0.0.99' },
            timestamp: hoursAgo(6)
        },
        {
            id: 'log-006',
            type: 'create',
            description: 'Membuat disposisi untuk surat B-123/DIKTI/I/2026',
            user: { id: 'user-002', name: 'Dr. Ahmad Fauzi, M.Kom' },
            details: { surat_id: 'sm-001', disposisi_id: 'disp-001' },
            timestamp: '2026-01-09T08:00:00Z'
        },
        {
            id: 'log-007',
            type: 'update',
            description: 'Mengubah pengaturan penomoran surat',
            user: { id: 'user-001', name: 'Administrator' },
            details: { setting: 'penomoran', format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}' },
            timestamp: daysAgo(7, 10)
        },
        {
            id: 'log-008',
            type: 'delete',
            description: 'Menghapus draft surat: Pengumuman Lama',
            user: { id: 'user-006', name: 'Budi Santoso, A.Md.' },
            details: { surat_id: 'sk-old', status: 'draft' },
            timestamp: daysAgo(3, 14)
        },
        {
            id: 'log-009',
            type: 'export',
            description: 'Mengexport laporan surat keluar (PDF)',
            user: { id: 'user-002', name: 'Dr. Ahmad Fauzi, M.Kom' },
            details: { format: 'pdf', periode: 'Januari 2026' },
            timestamp: daysAgo(5, 16)
        },
        {
            id: 'log-010',
            type: 'logout',
            description: 'Administrator logout',
            user: { id: 'user-001', name: 'Administrator' },
            details: { sessionDuration: '8 jam 30 menit' },
            timestamp: hoursAgo(10)
        }
    ],

    // ============================================
    // SETTINGS
    // ============================================
    settings: {
        instansi: {
            nama: 'Fakultas Ilmu Komputer',
            singkatan: 'FIKOM',
            alamat: 'Jl. Contoh No. 123, Jakarta 12345',
            telepon: '(021) 12345678',
            email: 'admin@fikom.ac.id',
            website: 'https://fikom.ac.id'
        },
        penomoran: {
            format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}',
            separator: '/',
            resetPeriode: 'tahun',
            paddingLength: 3,
            startNumber: 1,
            nextNumber: 46
        },
        units: [
            { id: 'dekanat', name: 'Dekanat', code: 'UN.01' },
            { id: 'prodi_ti', name: 'Prodi Teknik Informatika', code: 'UN.02' },
            { id: 'prodi_si', name: 'Prodi Sistem Informasi', code: 'UN.03' },
            { id: 'baak', name: 'BAAK', code: 'UN.04' },
            { id: 'bauk', name: 'BAUK', code: 'UN.05' },
            { id: 'lppm', name: 'LPPM', code: 'UN.06' }
        ]
    },

    // ============================================
    // DASHBOARD STATS
    // ============================================
    dashboard: {
        stats: {
            suratKeluar: { total: 5, draft: 1, proses: 1, completed: 2, ditolak: 1 },
            suratMasuk: { total: 3, diterima: 1, diteruskan: 2 },
            disposisi: { total: 3, aktif: 2, selesai: 1 },
            users: { total: 10, active: 8, inactive: 1, pending: 1 }
        },
        trendData: {
            labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'],
            masuk: [5, 8, 6, 9],
            keluar: [3, 7, 4, 6]
        }
    }
};

// Add dynamic timestamps for unread notifications
dataMock.notifications.forEach(n => {
    if (!n.read && !n.createdAt.includes('2026-01')) {
        n.createdAt = hoursAgo(Math.floor(Math.random() * 24) + 1);
    }
});

// Export
export default dataMock;