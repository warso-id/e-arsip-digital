// tests/mocks/data-mock.js - Mock Data for Testing 2026
/**
 * E-Arsip Digital - Mock Data
 * Version: 2026.1.0
 * Provides comprehensive mock data for testing
 */

const dataMock = {
    // ============================================
    // USERS
    // ============================================
    users: [
        {
            id: 'user-001',
            username: 'admin',
            fullname: 'Administrator',
            email: 'admin@e-arsip.id',
            phone: '081234567890',
            role: 'admin',
            unit: 'Dekanat',
            nip: '198501012010011001',
            status: 'active',
            avatar: null,
            permissions: ['manage_users', 'manage_surat', 'approve_surat', 'view_reports', 'export_data', 'manage_settings'],
            lastLogin: '2026-01-15T08:30:00Z',
            createdAt: '2025-01-01T00:00:00Z'
        },
        {
            id: 'user-002',
            username: 'dekan',
            fullname: 'Dr. Ahmad Fauzi, M.Kom',
            email: 'dekan@e-arsip.id',
            phone: '081234567891',
            role: 'dekan',
            unit: 'Dekanat',
            nip: '197506152005011002',
            status: 'active',
            avatar: null,
            permissions: ['approve_surat', 'view_reports'],
            lastLogin: '2026-01-14T16:00:00Z',
            createdAt: '2025-01-15T00:00:00Z'
        },
        {
            id: 'user-003',
            username: 'kaprodi_ti',
            fullname: 'Siti Nurhaliza, S.Kom., M.T.',
            email: 'kaprodi_ti@e-arsip.id',
            phone: '081234567892',
            role: 'kaprodi',
            unit: 'Prodi TI',
            nip: '198802122010012003',
            status: 'active',
            avatar: null,
            permissions: ['manage_surat', 'view_reports'],
            lastLogin: '2026-01-15T09:00:00Z',
            createdAt: '2025-02-01T00:00:00Z'
        },
        {
            id: 'user-004',
            username: 'staf_tu',
            fullname: 'Budi Santoso, A.Md.',
            email: 'staf@e-arsip.id',
            phone: '081234567893',
            role: 'staf',
            unit: 'TU',
            nip: '199203152015011004',
            status: 'active',
            avatar: null,
            permissions: ['manage_surat'],
            lastLogin: '2026-01-15T07:30:00Z',
            createdAt: '2025-03-01T00:00:00Z'
        },
        {
            id: 'user-005',
            username: 'mahasiswa1',
            fullname: 'Dewi Lestari',
            email: 'dewi@student.id',
            phone: '081234567894',
            role: 'mahasiswa',
            unit: 'Prodi TI',
            nip: null,
            status: 'active',
            avatar: null,
            permissions: [],
            lastLogin: '2026-01-10T10:00:00Z',
            createdAt: '2025-08-01T00:00:00Z'
        }
    ],
    
    // ============================================
    // SURAT KELUAR
    // ============================================
    suratKeluar: [
        {
            id: 'sk-001',
            nomor_surat: '001/UN.01/UM/I/2026',
            perihal: 'Undangan Rapat Koordinasi',
            jenis: 'undangan',
            sifat: 'segera',
            tujuan: 'Seluruh Kaprodi',
            tanggal_surat: '2026-01-10',
            status: 'disetujui',
            pengaju: 'Staf TU',
            penandatangan: 'Dr. Ahmad Fauzi, M.Kom',
            isi_ringkas: 'Mengundang seluruh Kaprodi untuk rapat koordinasi semester genap',
            tembusan: ['Wadek I', 'Wadek II'],
            approval_history: [
                { approver: 'Admin', status: 'approved', catatan: 'Sesuai', timestamp: '2026-01-10T08:00:00Z' },
                { approver: 'Dekan', status: 'approved', catatan: 'Disetujui', timestamp: '2026-01-10T14:00:00Z' }
            ],
            createdAt: '2026-01-10T07:00:00Z'
        },
        {
            id: 'sk-002',
            nomor_surat: '002/UN.01/KU/I/2026',
            perihal: 'Permohonan Dana Kegiatan',
            jenis: 'permohonan',
            sifat: 'biasa',
            tujuan: 'BAUK',
            tanggal_surat: '2026-01-12',
            status: 'proses',
            pengaju: 'Kaprodi TI',
            penandatangan: null,
            isi_ringkas: 'Mengajukan dana untuk kegiatan workshop pemrograman',
            tembusan: [],
            approval_history: [
                { approver: 'Admin', status: 'approved', catatan: 'Lengkapi lampiran', timestamp: '2026-01-12T09:00:00Z' }
            ],
            createdAt: '2026-01-12T08:00:00Z'
        },
        {
            id: 'sk-003',
            nomor_surat: '003/UN.01/AK/I/2026',
            perihal: 'Pengumuman Jadwal Ujian',
            jenis: 'pengumuman',
            sifat: 'penting',
            tujuan: 'Seluruh Mahasiswa',
            tanggal_surat: '2026-01-14',
            status: 'draft',
            pengaju: 'Staf TU',
            penandatangan: null,
            isi_ringkas: 'Memberitahukan jadwal ujian akhir semester',
            tembusan: [],
            approval_history: [],
            createdAt: '2026-01-14T10:00:00Z'
        },
        {
            id: 'sk-004',
            nomor_surat: '004/UN.01/KER/I/2026',
            perihal: 'Proposal Kerjasama Penelitian',
            jenis: 'proposal',
            sifat: 'rahasia',
            tujuan: 'PT. Teknologi Nusantara',
            tanggal_surat: '2026-01-15',
            status: 'terkirim',
            pengaju: 'Dekan',
            penandatangan: 'Dr. Ahmad Fauzi, M.Kom',
            isi_ringkas: 'Mengajukan proposal kerjasama penelitian bidang AI',
            tembusan: ['Warek III'],
            approval_history: [
                { approver: 'Admin', status: 'approved', catatan: 'OK', timestamp: '2026-01-15T08:00:00Z' },
                { approver: 'Dekan', status: 'approved', catatan: 'Lanjutkan', timestamp: '2026-01-15T13:00:00Z' }
            ],
            createdAt: '2026-01-15T07:00:00Z'
        },
        {
            id: 'sk-005',
            nomor_surat: '005/UN.01/SK/I/2026',
            perihal: 'Surat Keputusan Pengangkatan',
            jenis: 'keputusan',
            sifat: 'penting',
            tujuan: 'Dr. Budi Prasetyo',
            tanggal_surat: '2026-01-08',
            status: 'ditolak',
            pengaju: 'Admin',
            penandatangan: null,
            isi_ringkas: 'SK Pengangkatan sebagai Koordinator Penelitian',
            tembusan: [],
            approval_history: [
                { approver: 'Dekan', status: 'rejected', catatan: 'Revisi isi SK', timestamp: '2026-01-09T10:00:00Z' }
            ],
            createdAt: '2026-01-08T09:00:00Z'
        }
    ],
    
    // ============================================
    // SURAT MASUK
    // ============================================
    suratMasuk: [
        {
            id: 'sm-001',
            nomor_surat: 'B-123/DIKTI/I/2026',
            perihal: 'Pemberitahuan Hibah Penelitian',
            pengirim: 'Kementerian Pendidikan',
            instansi: 'Kemendikbud RI',
            tgl_surat: '2026-01-05',
            tgl_terima: '2026-01-08',
            jenis: 'pemberitahuan',
            sifat: 'penting',
            isi_ringkas: 'Memberitahukan penerimaan hibah penelitian untuk tahun 2026',
            createdAt: '2026-01-08T10:00:00Z'
        },
        {
            id: 'sm-002',
            nomor_surat: '045/KOP/I/2026',
            perihal: 'Undangan Seminar Nasional',
            pengirim: 'Universitas Indonesia',
            instansi: 'Universitas Indonesia',
            tgl_surat: '2026-01-10',
            tgl_terima: '2026-01-12',
            jenis: 'undangan',
            sifat: 'biasa',
            isi_ringkas: 'Mengundang dosen untuk menjadi pembicara seminar nasional',
            createdAt: '2026-01-12T11:00:00Z'
        },
        {
            id: 'sm-003',
            nomor_surat: '089/PT.TN/I/2026',
            perihal: 'Penawaran Kerjasama Magang',
            pengirim: 'PT. Teknologi Nusantara',
            instansi: 'PT. Teknologi Nusantara',
            tgl_surat: '2026-01-13',
            tgl_terima: '2026-01-15',
            jenis: 'penawaran',
            sifat: 'segera',
            isi_ringkas: 'Menawarkan program magang untuk mahasiswa',
            createdAt: '2026-01-15T08:00:00Z'
        }
    ],
    
    // ============================================
    // DISPOSISI
    // ============================================
    disposisi: [
        {
            id: 'disp-001',
            surat_id: 'sm-001',
            dari: 'Dekan',
            dari_nama: 'Dr. Ahmad Fauzi, M.Kom',
            kepada: 'Wadek I',
            kepada_nama: 'Wakil Dekan I',
            isi_disposisi: 'Mohon ditindaklanjuti dan disiapkan proposalnya',
            sifat: 'segera',
            batas_waktu: '2026-01-20',
            status: 'proses',
            createdAt: '2026-01-09T08:00:00Z'
        },
        {
            id: 'disp-002',
            surat_id: 'sm-002',
            dari: 'Dekan',
            dari_nama: 'Dr. Ahmad Fauzi, M.Kom',
            kepada: 'Kaprodi TI',
            kepada_nama: 'Siti Nurhaliza, S.Kom., M.T.',
            isi_disposisi: 'Silakan ditunjuk dosen yang akan menjadi pembicara',
            sifat: 'biasa',
            batas_waktu: '2026-01-25',
            status: 'proses',
            createdAt: '2026-01-13T09:00:00Z'
        },
        {
            id: 'disp-003',
            surat_id: 'sm-001',
            dari: 'Wadek I',
            dari_nama: 'Wakil Dekan I',
            kepada: 'Kaprodi TI',
            kepada_nama: 'Siti Nurhaliza, S.Kom., M.T.',
            isi_disposisi: 'Siapkan tim untuk menyusun proposal hibah',
            sifat: 'segera',
            batas_waktu: '2026-01-18',
            status: 'selesai',
            createdAt: '2026-01-10T10:00:00Z'
        }
    ],
    
    // ============================================
    // NOTIFICATIONS
    // ============================================
    notifications: [
        {
            id: 'notif-001',
            type: 'info',
            title: 'Surat Baru Disetujui',
            message: 'Surat No. 001/UN.01/UM/I/2026 telah disetujui oleh Dekan.',
            read: false,
            link: '/surat-keluar/preview.html?id=sk-001',
            createdAt: '2026-01-10T14:00:00Z'
        },
        {
            id: 'notif-002',
            type: 'warning',
            title: 'Batas Waktu Disposisi',
            message: 'Disposisi untuk surat B-123/DIKTI/I/2026 akan berakhir dalam 2 hari.',
            read: false,
            link: '/surat-masuk/disposisi.html?id=sm-001',
            createdAt: '2026-01-18T08:00:00Z'
        },
        {
            id: 'notif-003',
            type: 'success',
            title: 'Backup Berhasil',
            message: 'Backup sistem telah berhasil dibuat.',
            read: true,
            link: null,
            createdAt: '2026-01-15T02:00:00Z'
        },
        {
            id: 'notif-004',
            type: 'info',
            title: 'Surat Masuk Baru',
            message: 'Surat masuk dari PT. Teknologi Nusantara telah dicatat.',
            read: true,
            link: '/surat-masuk/list.html',
            createdAt: '2026-01-15T08:00:00Z'
        },
        {
            id: 'notif-005',
            type: 'error',
            title: 'Approval Ditolak',
            message: 'Surat SK Pengangkatan ditolak dengan catatan: Revisi isi SK.',
            read: false,
            link: '/surat-keluar/approval.html',
            createdAt: '2026-01-09T10:00:00Z'
        }
    ],
    
    // ============================================
    // BACKUPS
    // ============================================
    backups: [
        {
            id: 'backup-001',
            name: 'backup-2026-01-15',
            type: 'full',
            size: 5242880,
            createdAt: '2026-01-15T02:00:00Z'
        },
        {
            id: 'backup-002',
            name: 'backup-2026-01-08',
            type: 'full',
            size: 4194304,
            createdAt: '2026-01-08T02:00:00Z'
        }
    ],
    
    // ============================================
    // ACTIVITY LOGS
    // ============================================
    logs: [
        {
            id: 'log-001',
            type: 'login',
            description: 'Administrator berhasil login',
            user: { id: 'user-001', name: 'Administrator' },
            details: { ip: '192.168.1.1', browser: 'Chrome 120' },
            timestamp: '2026-01-15T08:30:00Z'
        },
        {
            id: 'log-002',
            type: 'create',
            description: 'Membuat surat keluar: Proposal Kerjasama Penelitian',
            user: { id: 'user-001', name: 'Administrator' },
            details: { surat_id: 'sk-004' },
            timestamp: '2026-01-15T07:00:00Z'
        },
        {
            id: 'log-003',
            type: 'update',
            description: 'Menyetujui surat: Proposal Kerjasama Penelitian',
            user: { id: 'user-002', name: 'Dr. Ahmad Fauzi, M.Kom' },
            details: { surat_id: 'sk-004', status: 'disetujui' },
            timestamp: '2026-01-15T13:00:00Z'
        },
        {
            id: 'log-004',
            type: 'create',
            description: 'Input surat masuk: Penawaran Kerjasama Magang',
            user: { id: 'user-004', name: 'Budi Santoso, A.Md.' },
            details: { surat_id: 'sm-003' },
            timestamp: '2026-01-15T08:00:00Z'
        },
        {
            id: 'log-005',
            type: 'security',
            description: 'Percobaan login gagal',
            user: { id: null, name: 'unknown' },
            details: { username: 'hacker', attempts: 3 },
            timestamp: '2026-01-15T03:00:00Z'
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
            type: 'logout',
            description: 'Administrator logout',
            user: { id: 'user-001', name: 'Administrator' },
            details: {},
            timestamp: '2026-01-14T17:00:00Z'
        }
    ]
};

export default dataMock;
