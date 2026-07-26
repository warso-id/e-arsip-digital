// tests/fixtures/test-data.js - Comprehensive Test Fixtures 2026
/**
 * E-Arsip Digital - Enterprise Test Fixtures
 * Version: 2026.1.0
 * Reusable test data for unit, integration, and E2E testing
 * Features: Auth, Surat, Users, Settings, Notifications, API, Files,
 *           Backup, Signature, Validation, Security, Performance
 */

const TestData = {
    // ============================================
    // AUTH FIXTURES
    // ============================================
    auth: {
        validUser: {
            username: 'admin',
            password: 'Password123!',
            email: 'admin@e-arsip.id',
            role: 'admin',
            fullname: 'Administrator',
            nip: '198501012010011001'
        },
        users: [
            {
                username: 'dekan',
                password: 'DekanPass1!',
                email: 'dekan@e-arsip.id',
                role: 'dekan',
                fullname: 'Dr. Ahmad Fauzi, M.Kom'
            },
            {
                username: 'kaprodi',
                password: 'KaprodiPass1!',
                email: 'kaprodi@e-arsip.id',
                role: 'kaprodi',
                fullname: 'Siti Nurhaliza, S.Kom., M.T.'
            },
            {
                username: 'staf',
                password: 'StafPass1!',
                email: 'staf@e-arsip.id',
                role: 'staf',
                fullname: 'Budi Santoso'
            }
        ],
        invalidUsers: [
            { username: 'hacker', password: 'wrong', description: 'Non-existent user' },
            { username: 'admin', password: 'wrongpass', description: 'Wrong password' },
            { username: '', password: '', description: 'Empty credentials' },
            { username: '<script>alert(1)</script>', password: 'test', description: 'XSS attempt' },
            { username: "admin'--", password: 'test', description: 'SQL injection attempt' }
        ],
        lockedUser: {
            username: 'locked_user',
            password: 'LockedPass1!',
            loginAttempts: 5,
            lockedUntil: Date.now() + 1800000
        },
        tokens: {
            accessToken: generateMockJWT({
                sub: 'user-001',
                role: 'admin',
                username: 'admin',
                exp: Math.floor(Date.now() / 1000) + 3600
            }),
            refreshToken: 'rt_' + generateRandomString(32),
            expiredToken: generateMockJWT({
                sub: 'user-001',
                role: 'admin',
                exp: Math.floor(Date.now() / 1000) - 3600
            }),
            malformedToken: 'not.a.valid.jwt.token',
            tamperedToken: generateMockJWT({
                sub: 'user-001',
                role: 'admin',
                exp: Math.floor(Date.now() / 1000) + 3600
            }).replace(/\./, 'X')
        },
        sessions: {
            valid: {
                id: 'sess-001',
                token: 'valid-token',
                refreshToken: 'valid-refresh',
                csrfToken: 'csrf-valid-token',
                user: { id: 'user-001', username: 'admin', role: 'admin' },
                createdAt: Date.now() - 3600000,
                lastActivity: Date.now(),
                expiresAt: Date.now() + 3600000,
                absoluteExpiresAt: Date.now() + 28800000,
                deviceInfo: { platform: 'Win32', language: 'id-ID' },
                fingerprint: 'abc123def456',
                isPWA: false
            },
            expired: {
                id: 'sess-002',
                token: 'expired-token',
                user: { id: 'user-001', username: 'admin', role: 'admin' },
                createdAt: Date.now() - 86400000,
                lastActivity: Date.now() - 7200000,
                expiresAt: Date.now() - 3600000,
                absoluteExpiresAt: Date.now() + 28800000
            },
            absoluteExpired: {
                id: 'sess-003',
                token: 'absolute-expired-token',
                user: { id: 'user-002', username: 'dekan', role: 'dekan' },
                createdAt: Date.now() - 86400000,
                lastActivity: Date.now() - 3600000,
                expiresAt: Date.now() + 3600000,
                absoluteExpiresAt: Date.now() - 3600000
            }
        },
        authHeaders: {
            valid: { 'Authorization': 'Bearer valid-token' },
            expired: { 'Authorization': 'Bearer expired-token' },
            missing: {},
            malformed: { 'Authorization': 'InvalidFormat valid-token' }
        }
    },

    // ============================================
    // SURAT FIXTURES
    // ============================================
    surat: {
        keluar: {
            valid: {
                perihal: 'Undangan Rapat Koordinasi Semester Genap',
                jenis: 'undangan',
                sifat: 'segera',
                tujuan: 'Seluruh Kaprodi',
                tanggal_surat: '2026-01-15',
                isi_ringkas: 'Mengundang seluruh Kaprodi untuk rapat koordinasi persiapan semester genap 2025/2026',
                nomor_surat: '045/UN.01/UM/I/2026',
                klasifikasi: 'UM',
                unit: 'dekanat'
            },
            minimal: {
                perihal: 'Surat Pemberitahuan',
                jenis: 'pemberitahuan',
                tujuan: 'Mahasiswa'
            },
            invalid: {
                emptyPerihal: { perihal: '', jenis: 'undangan', tujuan: 'Test' },
                emptyJenis: { perihal: 'Test', jenis: '', tujuan: 'Test' },
                emptyTujuan: { perihal: 'Test', jenis: 'undangan', tujuan: '' },
                tooLong: { perihal: 'A'.repeat(501), jenis: 'undangan', tujuan: 'Test' }
            },
            updateData: {
                perihal: 'Undangan Rapat Koordinasi (Revisi)',
                sifat: 'sangat_segera',
                isi_ringkas: 'Revisi jadwal rapat koordinasi'
            },
            list: generateSuratList(25, 'keluar')
        },
        masuk: {
            valid: {
                nomor_surat: 'B-123/DIKTI/I/2026',
                perihal: 'Pemberitahuan Hibah Penelitian',
                pengirim: 'Kementerian Pendidikan Tinggi',
                tgl_surat: '2026-01-10',
                tgl_terima: '2026-01-15',
                sifat: 'penting',
                jenis: 'pemberitahuan'
            },
            invalid: {
                noPengirim: { nomor_surat: 'B-456/2026', perihal: 'Test', pengirim: '' },
                noPerihal: { nomor_surat: 'B-456/2026', perihal: '', pengirim: 'Test' }
            },
            list: generateSuratList(25, 'masuk')
        },
        disposisi: {
            valid: {
                surat_id: 'surat-masuk-001',
                kepada: 'kaprodi_ti',
                isi_disposisi: 'Mohon ditindaklanjuti dan dibuatkan laporan',
                batas_waktu: '2026-01-25',
                sifat: 'segera',
                prioritas: 'tinggi'
            },
            invalid: {
                noKepada: { isi_disposisi: 'Test', batas_waktu: '2026-01-25' },
                pastDate: { kepada: 'kaprodi_ti', isi_disposisi: 'Test', batas_waktu: '2025-01-01' }
            },
            statuses: ['belum', 'proses', 'selesai', 'terlambat'],
            list: generateDisposisiList(15)
        },
        approval: {
            valid: {
                surat_id: 'surat-keluar-001',
                status: 'disetujui',
                catatan: 'Surat sudah sesuai, silakan diproses',
                approver_id: 'user-002'
            },
            rejected: {
                surat_id: 'surat-keluar-002',
                status: 'ditolak',
                catatan: 'Perlu revisi pada bagian perihal',
                approver_id: 'user-002'
            },
            list: generateApprovalList(10)
        }
    },

    // ============================================
    // USER FIXTURES
    // ============================================
    users: {
        admin: {
            id: 'user-001',
            username: 'admin',
            fullname: 'Administrator',
            email: 'admin@e-arsip.id',
            role: 'super_admin',
            status: 'active',
            unit: 'dekanat',
            nip: '198501012010011001',
            phone: '08123456789',
            permissions: ['manage_users', 'manage_surat', 'approve_surat', 'view_reports', 'export_data', 'manage_settings', 'view_logs', 'backup_restore'],
            createdAt: '2025-01-15T08:00:00Z',
            lastLogin: new Date().toISOString(),
            avatar: null
        },
        list: generateUserList(15),
        roles: ['super_admin', 'admin', 'dekan', 'wadek', 'kaprodi', 'staf', 'dosen', 'mahasiswa'],
        statuses: ['active', 'inactive', 'pending'],
        newUser: {
            valid: {
                username: 'newuser',
                fullname: 'New User Test',
                email: 'new@e-arsip.id',
                password: 'Password123!',
                passwordConfirm: 'Password123!',
                role: 'staf',
                status: 'active'
            },
            invalidPassword: {
                username: 'newuser2',
                fullname: 'New User 2',
                email: 'new2@e-arsip.id',
                password: 'weak',
                role: 'staf'
            },
            duplicate: {
                username: 'admin',
                fullname: 'Duplicate Admin',
                email: 'duplicate@e-arsip.id',
                password: 'Password123!',
                role: 'staf'
            }
        }
    },

    // ============================================
    // SETTINGS FIXTURES
    // ============================================
    settings: {
        instansi: {
            nama: 'Fakultas Ilmu Komputer',
            singkatan: 'FIKOM',
            alamat: 'Jl. Contoh No. 123, Jakarta',
            telepon: '(021) 12345678',
            email: 'admin@fikom.ac.id'
        },
        penomoran: {
            format: '{nomor}/{kode_unit}/{klasifikasi}/{bulan_romawi}/{tahun}',
            separator: '/',
            resetPeriode: 'tahun',
            paddingLength: 3,
            startNumber: 1,
            nextNumber: 46,
            totalTahun: 1245,
            totalBulan: 45,
            units: [
                { id: 'dekanat', name: 'Dekanat', code: 'UN.01' },
                { id: 'prodi_ti', name: 'Prodi Teknik Informatika', code: 'UN.02' },
                { id: 'prodi_si', name: 'Prodi Sistem Informasi', code: 'UN.03' },
                { id: 'baak', name: 'BAAK', code: 'UN.04' },
                { id: 'bauk', name: 'BAUK', code: 'UN.05' }
            ]
        },
        security: {
            maxLoginAttempts: 5,
            lockoutDuration: 1800000,
            sessionTimeout: 3600000,
            idleTimeout: 1800000,
            passwordMinLength: 8,
            passwordRequireUppercase: true,
            passwordRequireLowercase: true,
            passwordRequireNumbers: true,
            passwordRequireSpecial: false,
            twoFactorEnabled: false,
            rateLimitRequests: 100,
            rateLimitWindow: 60000
        },
        backup: {
            schedule: 'weekly',
            lastBackup: new Date(Date.now() - 86400000).toISOString(),
            history: generateBackupHistory(10)
        },
        signatures: generateSignatureList(5)
    },

    // ============================================
    // NOTIFICATION FIXTURES
    // ============================================
    notifications: {
        list: [
            { id: 'n-001', type: 'info', category: 'surat', title: 'Surat Masuk Baru', message: 'Surat dari Kemendikbud telah dicatat', read: false, createdAt: new Date(Date.now() - 1800000).toISOString(), link: '/surat-masuk/' },
            { id: 'n-002', type: 'success', category: 'disposisi', title: 'Disposisi Selesai', message: 'Disposisi surat No. 123 telah ditindaklanjuti', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: 'n-003', type: 'warning', category: 'disposisi', title: 'Batas Waktu Mendekati', message: 'Disposisi akan berakhir dalam 1 hari', read: true, createdAt: new Date(Date.now() - 7200000).toISOString() },
            { id: 'n-004', type: 'error', category: 'sistem', title: 'Upload Gagal', message: 'Ukuran file terlalu besar (maks 10MB)', read: true, createdAt: new Date(Date.now() - 14400000).toISOString() },
            { id: 'n-005', type: 'approval', category: 'approval', title: 'Approval Diperlukan', message: 'Surat No. 067 menunggu approval Anda', read: false, createdAt: new Date(Date.now() - 28800000).toISOString(), link: '/approval/' }
        ],
        counts: { total: 5, unread: 3, info: 1, warning: 1, success: 1, error: 1, approval: 1 },
        types: ['info', 'success', 'warning', 'error', 'approval', 'system'],
        categories: ['surat', 'disposisi', 'approval', 'sistem', 'security']
    },

    // ============================================
    // API RESPONSE FIXTURES
    // ============================================
    apiResponses: {
        success: { success: true, message: 'Operation successful', data: null, timestamp: new Date().toISOString() },
        created: { success: true, message: 'Resource created', data: { id: 'new-id-001' }, status: 201 },
        updated: { success: true, message: 'Resource updated', data: { id: 'updated-id-001' } },
        deleted: { success: true, message: 'Resource deleted' },
        error: { success: false, error: 'Server Error', message: 'Internal server error', status: 500 },
        notFound: { success: false, error: 'Not Found', message: 'Resource not found', status: 404 },
        unauthorized: { success: false, error: 'Unauthorized', message: 'Authentication required', status: 401 },
        forbidden: { success: false, error: 'Forbidden', message: 'Access denied', status: 403 },
        validation: {
            success: false,
            error: 'Validation Error',
            message: 'Invalid data provided',
            status: 422,
            errors: {
                perihal: 'Perihal wajib diisi',
                jenis: 'Jenis surat tidak valid',
                email: 'Format email tidak valid'
            }
        },
        rateLimit: {
            success: false,
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Try again in 60 seconds.',
            retryAfter: 60,
            status: 429
        },
        networkError: new Error('Network request failed'),
        timeout: new Error('Request timed out after 10000ms'),
        paginated: {
            success: true,
            data: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 100,
                totalPages: 5,
                hasNext: true,
                hasPrev: false
            }
        }
    },

    // ============================================
    // FILE FIXTURES
    // ============================================
    files: {
        valid: {
            pdf: { name: 'document.pdf', type: 'application/pdf', size: 102400, lastModified: Date.now() },
            image: { name: 'photo.jpg', type: 'image/jpeg', size: 51200, lastModified: Date.now() },
            png: { name: 'signature.png', type: 'image/png', size: 25600, lastModified: Date.now() },
            docx: { name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 25600, lastModified: Date.now() },
            xlsx: { name: 'report.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 15360, lastModified: Date.now() }
        },
        invalid: {
            tooLarge: { name: 'large.pdf', type: 'application/pdf', size: 52428800, lastModified: Date.now() },
            wrongType: { name: 'script.exe', type: 'application/x-msdownload', size: 1024, lastModified: Date.now() },
            empty: { name: 'empty.pdf', type: 'application/pdf', size: 0, lastModified: Date.now() },
            doubleExt: { name: 'document.pdf.exe', type: 'application/pdf', size: 1024, lastModified: Date.now() },
            html: { name: 'page.html', type: 'text/html', size: 2048, lastModified: Date.now() }
        },
        backup: {
            valid: { name: 'backup-2026-01-15.zip', type: 'application/zip', size: 15728640 },
            json: { name: 'backup-2026-01-15.json', type: 'application/json', size: 5242880 },
            tarGz: { name: 'backup-2026-01-15.tar.gz', type: 'application/gzip', size: 10485760 }
        }
    },

    // ============================================
    // THEME FIXTURES
    // ============================================
    themes: {
        available: ['light', 'dark', 'blue', 'green', 'purple', 'orange', 'red'],
        definitions: {
            light: { name: 'Light', type: 'light', icon: 'sun', colors: { '--color-primary': '#2563eb', '--color-bg': '#ffffff', '--color-text': '#1e293b', '--color-sidebar': '#ffffff', '--color-card': '#ffffff' } },
            dark: { name: 'Dark', type: 'dark', icon: 'moon', colors: { '--color-primary': '#60a5fa', '--color-bg': '#0f172a', '--color-text': '#f1f5f9', '--color-sidebar': '#1e293b', '--color-card': '#1e293b' } },
            blue: { name: 'Ocean Blue', type: 'light', icon: 'water', colors: { '--color-primary': '#3b82f6', '--color-bg': '#f0f9ff', '--color-text': '#1e3a5f', '--color-sidebar': '#1e3a5f', '--color-card': '#ffffff' } },
            green: { name: 'Forest', type: 'light', icon: 'leaf', colors: { '--color-primary': '#22c55e', '--color-bg': '#f0fdf4', '--color-text': '#14532d', '--color-sidebar': '#14532d', '--color-card': '#ffffff' } },
            purple: { name: 'Royal', type: 'light', icon: 'crown', colors: { '--color-primary': '#a855f7', '--color-bg': '#faf5ff', '--color-text': '#3b0764', '--color-sidebar': '#3b0764', '--color-card': '#ffffff' } },
            orange: { name: 'Sunset', type: 'light', icon: 'sun', colors: { '--color-primary': '#f97316', '--color-bg': '#fff7ed', '--color-text': '#431407', '--color-sidebar': '#431407', '--color-card': '#ffffff' } },
            red: { name: 'Ruby', type: 'light', icon: 'heart', colors: { '--color-primary': '#ef4444', '--color-bg': '#fef2f2', '--color-text': '#450a0a', '--color-sidebar': '#450a0a', '--color-card': '#ffffff' } }
        },
        custom: { name: 'Custom', type: 'light', colors: { '--color-primary': '#6366f1', '--color-bg': '#fafafa', '--color-text': '#18181b', '--color-sidebar': '#27272a', '--color-card': '#ffffff' } }
    },

    // ============================================
    // VALIDATION FIXTURES
    // ============================================
    validation: {
        emails: {
            valid: ['user@example.com', 'test.user@domain.co.id', 'name+tag@test.org', 'user-name@domain.com'],
            invalid: ['notanemail', '@domain.com', 'user@', 'user @domain.com', '', null, undefined, 'a@b', 'user@.com']
        },
        phones: {
            valid: ['08123456789', '+628123456789', '6281234567890', '0812-3456-7890'],
            invalid: ['12345', 'abc', '0812', '+62abc', '12345678901234567890']
        },
        passwords: {
            valid: ['Password1', 'SecureP@ss123', 'C0mplex!Pass', 'Abcdefgh1'],
            weak: ['short', 'nouppercase1', 'nolowercase1', 'NoNumber!', 'NoSpecial1', '12345678', 'abcdefgh'],
            invalid: ['', null, '123', 'pass']
        },
        nip: {
            valid: ['198501012010011001', '199002152015012002', '197806302008121001'],
            invalid: ['12345', 'abcdefghijklmnopqr', '19850101201001100', '198501322010011001', '180001012010011001']
        },
        username: {
            valid: ['admin', 'user_01', 'test-user', 'john.doe'],
            invalid: ['ab', '', 'user@name', 'user name', 'a'.repeat(51)]
        },
        urls: {
            valid: ['https://example.com', 'http://localhost:8080', '/dashboard/', '../login.html'],
            invalid: ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'not-a-url', '']
        }
    },

    // ============================================
    // SECURITY TEST FIXTURES
    // ============================================
    security: {
        xss: {
            basic: '<script>alert("XSS")</script>',
            img: '<img src=x onerror=alert(1)>',
            svg: '<svg onload=alert(1)>',
            encoded: '%3Cscript%3Ealert(1)%3C/script%3E',
            doubleEncoded: '%253Cscript%253Ealert(1)%253C/script%253E',
            unicode: '\u003Cscript\u003Ealert(1)\u003C/script\u003E',
            eventHandler: '<div onmouseover="alert(1)">hover me</div>',
            cssInjection: 'expression(alert(1))',
            template: '{{constructor.constructor("alert(1)")()}}',
            nullByte: 'file.pdf%00.html',
            mixedCase: '<ScRiPt>alert(1)</sCrIpT>',
            multiline: '<img src="x"\nonerror="alert(1)">'
        },
        sqlInjection: {
            basic: "' OR '1'='1",
            union: "' UNION SELECT * FROM users--",
            drop: "'; DROP TABLE users; --",
            comment: "admin'--",
            batch: "SELECT * FROM users; DROP TABLE surat;"
        },
        csrf: {
            validToken: 'csrf-valid-token-32chars-long!',
            invalidToken: 'invalid-token',
            expiredToken: 'csrf-expired-token',
            missingToken: ''
        },
        pathTraversal: [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32',
            '%2e%2e%2f%2e%2e%2f',
            '....//....//etc/passwd'
        ]
    },

    // ============================================
    // PERFORMANCE TEST FIXTURES
    // ============================================
    performance: {
        largeSuratList: generateSuratList(1000, 'keluar'),
        largeUserList: generateUserList(500),
        largeNotificationList: generateNotificationList(200),
        deepNestedObject: generateNestedObject(10),
        longString: 'A'.repeat(1000000)
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateMockJWT(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const signature = generateRandomString(43);
    return `${header}.${body}.${signature}`;
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint32Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
    } else {
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return result;
}

function generateSuratList(count, type) {
    const list = [];
    const perihalList = [
        'Undangan Rapat', 'Pemberitahuan', 'Permohonan', 'Laporan',
        'Pengumuman', 'Edaran', 'Rekomendasi', 'Keputusan'
    ];
    const jenisList = ['undangan', 'pemberitahuan', 'permohonan', 'pengumuman', 'edaran'];
    const statusList = ['draft', 'proses', 'selesai', 'terkirim', 'ditolak'];

    for (let i = 0; i < count; i++) {
        list.push({
            id: `${type}-${String(i + 1).padStart(4, '0')}`,
            nomor_surat: `${String(i + 1).padStart(3, '0')}/UN.01/UM/I/2026`,
            perihal: `${perihalList[i % perihalList.length]} ${i + 1}`,
            jenis: jenisList[i % jenisList.length],
            status: statusList[i % statusList.length],
            tanggal: new Date(2026, 0, i + 1).toISOString(),
            pengirim: type === 'masuk' ? `Instansi ${i + 1}` : undefined,
            tujuan: type === 'keluar' ? `Unit ${i + 1}` : undefined
        });
    }
    return list;
}

function generateUserList(count) {
    const list = [];
    const roles = ['admin', 'dekan', 'wadek', 'kaprodi', 'staf', 'dosen'];
    const units = ['dekanat', 'prodi_ti', 'prodi_si', 'baak', 'bauk'];
    const statuses = ['active', 'active', 'active', 'inactive'];

    for (let i = 0; i < count; i++) {
        list.push({
            id: `user-${String(i + 1).padStart(4, '0')}`,
            username: `user${i + 1}`,
            fullname: `User Test ${i + 1}`,
            email: `user${i + 1}@e-arsip.id`,
            role: roles[i % roles.length],
            unit: units[i % units.length],
            status: statuses[i % statuses.length],
            nip: `198${String(i + 1).padStart(2, '0')}12201001100${String(i).padStart(2, '0')}`.substring(0, 18),
            createdAt: new Date(2025, 0, i + 1).toISOString()
        });
    }
    return list;
}

function generateDisposisiList(count) {
    const list = [];
    const statuses = ['belum', 'proses', 'selesai'];
    const units = ['kaprodi_ti', 'kaprodi_si', 'wadek', 'dekan'];

    for (let i = 0; i < count; i++) {
        list.push({
            id: `disp-${String(i + 1).padStart(4, '0')}`,
            surat_id: `surat-masuk-${String(i + 1).padStart(4, '0')}`,
            kepada: units[i % units.length],
            isi_disposisi: `Mohon ditindaklanjuti - disposisi ${i + 1}`,
            batas_waktu: new Date(2026, 1, i + 1).toISOString(),
            status: statuses[i % statuses.length],
            sifat: i % 2 === 0 ? 'segera' : 'biasa',
            createdAt: new Date(2026, 0, i + 1).toISOString()
        });
    }
    return list;
}

function generateApprovalList(count) {
    const list = [];
    const statuses = ['disetujui', 'ditolak', 'menunggu'];

    for (let i = 0; i < count; i++) {
        list.push({
            id: `appr-${String(i + 1).padStart(4, '0')}`,
            surat_id: `surat-keluar-${String(i + 1).padStart(4, '0')}`,
            approver: 'Dr. Ahmad Fauzi, M.Kom',
            status: statuses[i % statuses.length],
            catatan: i % 3 === 0 ? 'Disetujui' : i % 3 === 1 ? 'Perlu revisi' : '',
            tanggal_ajuan: new Date(2026, 0, i + 1).toISOString(),
            tanggal_approval: statuses[i % statuses.length] !== 'menunggu' ? new Date(2026, 0, i + 2).toISOString() : null
        });
    }
    return list;
}

function generateBackupHistory(count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push({
            id: `backup-${String(i + 1).padStart(4, '0')}`,
            name: `backup-2026-01-${String(15 - i).padStart(2, '0')}-020000`,
            type: i % 3 === 0 ? 'full' : i % 3 === 1 ? 'surat' : 'settings',
            size: Math.floor(Math.random() * 50 * 1024 * 1024) + 1048576,
            createdAt: new Date(2026, 0, 15 - i).toISOString()
        });
    }
    return list;
}

function generateSignatureList(count) {
    const list = [];
    const names = ['Dr. Ahmad Fauzi, M.Kom', 'Siti Nurhaliza, S.Kom., M.T.', 'Budi Santoso, S.T.', 'Rina Wati, M.Pd.', 'Dedi Kusuma, Ph.D.'];
    const positions = ['Dekan', 'Kaprodi TI', 'Kaprodi SI', 'Wadek I', 'Wadek II'];

    for (let i = 0; i < Math.min(count, names.length); i++) {
        list.push({
            id: `ttd-${String(i + 1).padStart(4, '0')}`,
            name: names[i],
            position: positions[i],
            isDefault: i === 0,
            createdAt: new Date(2026, 0, i + 1).toISOString()
        });
    }
    return list;
}

function generateNotificationList(count) {
    const list = [];
    const types = ['info', 'success', 'warning', 'error'];
    for (let i = 0; i < count; i++) {
        list.push({
            id: `n-${String(i + 1).padStart(4, '0')}`,
            type: types[i % types.length],
            title: `Notification ${i + 1}`,
            message: `Test notification message ${i + 1}`,
            read: i % 3 === 0,
            createdAt: new Date(Date.now() - i * 3600000).toISOString()
        });
    }
    return list;
}

function generateNestedObject(depth) {
    if (depth <= 0) return { value: 'leaf' };
    return {
        level: depth,
        child: generateNestedObject(depth - 1),
        data: { array: [1, 2, 3], string: 'test' }
    };
}

// Export
export default TestData;